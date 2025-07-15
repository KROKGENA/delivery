// === GLOBAL STATE ===
let vehicles = [];
let tariffData = null;

// === LOAD TARIFFS ===
async function loadTariffs(forceReloadFromGit = false) {
  try {
    const basePath = location.pathname.includes("/delivery/") ? "/delivery/" : "/";
    const saved = localStorage.getItem("custom_tariffs");

    let json;
    if (saved && !forceReloadFromGit) {
      json = JSON.parse(saved);
      console.log("✅ Загружено из localStorage");
    } else {
      const response = await fetch(`${basePath}data/tariffs.json?nocache=${Date.now()}`);
      json = await response.json();
      localStorage.setItem("custom_tariffs", JSON.stringify(json));
      console.log("✅ Загружено с GitHub");
    }

    window.tariffData = json;

    vehicles = json.vehicles.map(v => ({
      ...v,
      maxWeight: getMaxWeightFromName(v.name),
      loadingTypes: getLoadingTypesFromName(v.name)
    }));
  } catch (e) {
    console.error("❌ Не удалось загрузить тарифы:", e);
    alert("Ошибка загрузки тарифов: " + e.message);
  }
}

// === VEHICLE UTILS ===
function getMaxWeightFromName(name) {
  const lowered = name.toLowerCase();
  if (/манипулятор 15т/.test(lowered)) return 15000;
  if (/манипулятор 10т/.test(lowered)) return 10000;
  if (/манипулятор 5т/.test(lowered)) return 5000;
  if (/еврофура/.test(lowered)) return 20000;
  if (/\b20т\b/.test(lowered)) return 20000;
  if (/\b15т\b/.test(lowered)) return 15000;
  if (/\b10т\b/.test(lowered)) return 10000;
  if (/\b5т\b/.test(lowered)) return 5000;
  if (/\b3т\b/.test(lowered)) return 3000;
  if (/\b1\.5т\b/.test(lowered)) return 1500;
  if (/\b1т\b/.test(lowered)) return 1000;
  return 0;
}

function getLoadingTypesFromName(name) {
  const lowered = name.toLowerCase();
  if (/гидролифт/.test(lowered)) return ["гидролифт"];
  if (/манипулятор/.test(lowered)) return ["manipulator"];
  return ["любая", "верхняя", "боковая"];
}

function selectVehicle(weight, loadingType) {
  const normalizedType = (loadingType || "любая").toLowerCase();

  const vehiclePriority = [
    { name: "Манипулятор 15т", min: 10001, max: 15000 },
    { name: "Манипулятор 10т", min: 5001, max: 10000 },
    { name: "Манипулятор 5т",  min: 0,    max: 5000 },
    { name: "а/м 5т гидролифт", min: 0,    max: 5000 },
    { name: "Еврофура 20т",    min: 10001, max: 20000 },
    { name: "а/м 10т",         min: 5001, max: 10000 },
    { name: "а/м 5т",          min: 3001, max: 5000 },
    { name: "а/м до 3т",       min: 1501, max: 3000 },
    { name: "а/м до 1.5т",     min: 1001, max: 1500 },
    { name: "а/м до 1т",       min: 0,    max: 1000 },
  ];

  for (const rule of vehiclePriority) {
    const fitsWeight = weight >= rule.min && weight <= rule.max;
    if (!fitsWeight) continue;

    const found = vehicles.find(v =>
      v.name.toLowerCase() === rule.name.toLowerCase() &&
      v.loadingTypes.includes(normalizedType)
    );

    if (found) return found;
  }

  return null;
}

function calculateKmCostSmooth(distance, baseRate, minRate, decay = 0.01) {
  const kmStep = 0.1;
  let cost = 0;
  for (let km = kmStep; km <= distance; km += kmStep) {
    const rate = minRate + (baseRate - minRate) * Math.exp(-decay * km);
    cost += rate * kmStep;
  }
  return Math.round(cost);
}

function getLoadingSurcharge(vehicle, loadingType) {
  const wt = vehicle.maxWeight;
  if (loadingType === "любая") return 0;
  if (wt <= 3000) return 1500;
  if (wt === 5000) return loadingType === "боковая" ? 2000 : 2500;
  if (wt === 10000) return loadingType === "боковая" ? 2500 : 3000;
  if (wt === 20000) return loadingType === "боковая" ? 3000 : 3500;
  return 0;
}

// === MOVERS ===
function getMoversCost(data) {
  if (!data.need_movers || !tariffData || !tariffData.movers) return 0;

  const movers = tariffData.movers;
  const floor = parseInt(data.floor || 1);
  const hasLift = data.lift === "true";
  const isOnlyUnload = data.only_unload === "true";

  const standardWeight = data.weight_standard || 0;
  const largeCount = parseInt(data.large_count || 0);
  const format = (data.large_format || "").replace("x", "×");
  let total = 0;

  // Стандартная плитка
  if (standardWeight > 0 && movers.standard) {
    const unloadRate = movers.standard.unloadPerKg;
    const floorRates = movers.standard.floorPerKg;

    if (isOnlyUnload) {
      total += standardWeight * unloadRate;
    } else if (hasLift) {
      total += standardWeight * floorRates.withLift;
    } else {
      const rateEntry = floorRates.noLift.find(r => floor <= r.maxFloor);
      const rate = rateEntry ? rateEntry.rate : floorRates.noLift.slice(-1)[0].rate;
      total += standardWeight * rate;
    }
  }

  // Крупноформат
  const formats = movers.large?.formats || {};
  const info = formats[format];

  if (largeCount > 0 && info) {
    const perSheet = isOnlyUnload
      ? info.noLiftPerFloor
      : hasLift && info.liftAllowed
        ? info.withLift
        : info.noLiftPerFloor * floor;

    let subtotal = largeCount * perSheet;
    if (subtotal < info.minTotal) subtotal = info.minTotal;

    total += subtotal;
  }

  return Math.round(total);
}

// === DELIVERY ===
async function calculateDelivery() {
  if (vehicles.length === 0) await loadTariffs();
  if (!window.formData) return alert("Сначала сохраните параметры");

  const data = window.formData;
  const totalWeight = (data.weight_standard || 0) + (data.weight_large || 0);
  if (totalWeight === 0) return alert("Укажите вес плитки");

  const loadingType = data.loading_type || "любая";
  let deliveryCost = 0;
  let moversCost = 0;
  let vehicleName = "";
  let details = "";

  const underground = data.underground && parseFloat(data.height_limit) < 2.2;

  if (underground) {
    let left = totalWeight;
    const parts = [];

    while (left > 0) {
      if (left > 1500) {
        parts.push(1500);
        left -= 1500;
      } else {
        parts.push(left);
        left = 0;
      }
    }

    for (const weight of parts) {
      const v = selectVehicle(weight, "верхняя");
      if (!v) continue;
      const kmCost = calculateKmCostSmooth(data.deliveryDistance, v.basePerKm, v.minPerKm, v.decay);
      const surcharge = getLoadingSurcharge(v, "верхняя");
      deliveryCost += v.minTariff + kmCost + surcharge;
      details += `<p>🚚 ${v.name} (${weight} кг): ${v.minTariff} + ${kmCost} + ${surcharge}</p>`;
    }

    deliveryCost += 1500;
    vehicleName = "Несколько авто (ограничение по высоте)";
  } else {
    const v = selectVehicle(totalWeight, loadingType);
    if (!v) {
      document.getElementById("delivery_result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта</p>";
      return;
    }

    const kmCost = calculateKmCostSmooth(data.deliveryDistance, v.basePerKm, v.minPerKm, v.decay);
    const surcharge = getLoadingSurcharge(v, loadingType);
    deliveryCost = v.minTariff + kmCost + surcharge;
    if (data.return_pallets) deliveryCost += 2500;
    if (data.precise_time) deliveryCost += 2500;
    if (data.underground) deliveryCost += 1500;

    vehicleName = v.name;
    details = `
      <p><strong>Подача:</strong> ${v.minTariff} ₽</p>
      <p><strong>Км:</strong> ${data.deliveryDistance.toFixed(2)} км ≈ ${kmCost} ₽</p>
      ${surcharge > 0 ? `<p><strong>Надбавка (${loadingType}):</strong> ${surcharge} ₽</p>` : ""}
    `;
  }

  moversCost = getMoversCost(data);

  const html = `
    <p><strong>🚚 Доставка:</strong> ${deliveryCost.toLocaleString()} ₽</p>
    <p><strong>👷 Грузчики:</strong> ${moversCost.toLocaleString()} ₽</p>
    <hr>
    <h3>Итого: ${(deliveryCost + moversCost).toLocaleString()} ₽</h3>
    <p><a href="#" onclick="toggleDetails(event)">Показать подробности</a></p>
    <div id="details_block" style="display:none;">
      <h3>🚚 Расчёт доставки</h3>
      <p><strong>Транспорт:</strong> ${vehicleName}</p>
      <p><strong>Вес:</strong> ${totalWeight} кг</p>
      <p><strong>Тип загрузки:</strong> ${loadingType}</p>
      <p><strong>Дистанция:</strong> ${data.deliveryDistance.toFixed(2)} км</p>
      ${details}
      ${moversCost > 0 ? `<h3>👷 Грузчики:</h3><p>${moversCost} ₽</p>` : ""}
    </div>
  `;

  document.getElementById("delivery_result").innerHTML = html;
}

// === TOGGLE DETAILS ===
function toggleDetails(e) {
  e.preventDefault();
  const block = document.getElementById("details_block");
  const link = e.target;
  if (block.style.display === "block") {
    block.style.display = "none";
    link.textContent = "Показать подробности";
  } else {
    block.style.display = "block";
    link.textContent = "Скрыть подробности";
  }
}
