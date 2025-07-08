let vehicles = [];

async function loadTariffs() {
  try {
    const response = await fetch("data/tariffs.json?" + Date.now()); // отключаем кеш
    const json = await response.json();

    console.log("✅ Загруженные тарифы:", json); // отладка

    vehicles = json.map((v) => ({
      ...v,
      maxWeight: getMaxWeightFromName(v.name),
      loadingTypes: getLoadingTypesFromName(v.name)
    }));

    if (vehicles.length === 0) {
      alert("Тарифы не загружены или пустые. Проверь файл tariffs.json");
    }
  } catch (e) {
    console.error("❌ Не удалось загрузить тарифы:", e);
    alert("Ошибка загрузки тарифов. Проверь файл tariffs.json");
  }
}

function getMaxWeightFromName(name) {
  if (name.includes("20т")) return 20000;
  if (name.includes("15т")) return 15000;
  if (name.includes("10т")) return 10000;
  if (name.includes("5т")) return 5000;
  if (name.includes("3т")) return 3000;
  if (name.includes("1.5т")) return 1500;
  if (name.includes("1т")) return 1000;
  return 0;
}

function getLoadingTypesFromName(name) {
  if (name.includes("гидролифт")) return ["гидролифт"];
  if (name.includes("Манипулятор")) return ["manipulator"];
  return ["верхняя", "боковая", "любая"];
}

function selectVehicle(weight, loadingType) {
  return vehicles.find(v => v.maxWeight >= weight && v.loadingTypes.includes(loadingType));
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
  if (loadingType === "любая") return 0;
  const wt = vehicle.maxWeight;
  if (wt <= 3000) return 1500;
  if (wt === 5000) return loadingType === "боковая" ? 2000 : 2500;
  if (wt === 10000) return loadingType === "боковая" ? 2500 : 3000;
  if (wt === 20000) return loadingType === "боковая" ? 3000 : 3500;
  return 0;
}

function getMoversCost(data) {
  if (!data.need_movers) return 0;
  const floor = parseInt(data.floor || 1);
  const hasLift = data.lift === "true";
  const isOnlyUnload = data.only_unload === "true";
  const standard = data.weight_standard || 0;
  const large = data.weight_large || 0;
  const format = data.large_format || "";

  let total = 0;

  if (large > 0) {
    const liftAllowed = ["100x200", "100x260", "100x280"].includes(format);
    if (isOnlyUnload) {
      total += large * 20;
    } else if (liftAllowed && hasLift) {
      total += large * 30;
    } else {
      const rate = floor <= 5 ? 50 : floor <= 10 ? 60 : floor <= 20 ? 70 : 90;
      total += large * rate;
    }
  }

  if (standard > 0) {
    if (isOnlyUnload) {
      total += standard * 7;
    } else if (hasLift) {
      total += standard * 9;
    } else {
      const rate = floor <= 5 ? 15 : floor <= 10 ? 20 : floor <= 20 ? 30 : 50;
      total += standard * rate;
    }
  }

  return total;
}

async function calculateDelivery() {
  if (vehicles.length === 0) {
    await loadTariffs();
  }

  if (!window.formData) {
    alert("Сначала сохраните параметры");
    return;
  }

  const data = window.formData;
  const totalWeight = (data.weight_standard || 0) + (data.weight_large || 0);
  const loadingType = data.loading_type || "любая";
  let vehicle;
  let deliveryCost = 0;
  let moversCost = 0;
  let vehicleName = "";
  let baseLine = "";

  if (data.underground && data.height_limit && parseFloat(data.height_limit) < 2.2) {
    let left = totalWeight;
    let parts = [];
    while (left > 0) {
      if (left > 1500) {
        parts.push(1500);
        left -= 1500;
      } else if (left > 1000) {
        parts.push(1000);
        parts.push(left - 1000);
        break;
      } else {
        parts.push(left);
        break;
      }
    }

    parts.forEach(w => {
      const v = selectVehicle(w, "верхняя");
      if (!v) return;
      const dist = data.deliveryDistance;
      deliveryCost += v.minTariff + calculateKmCostSmooth(dist, v.basePerKm, v.minPerKm, v.decay) + getLoadingSurcharge(v, "верхняя");
      baseLine += `<p>🚚 ${v.name}: ${v.minTariff.toLocaleString()} ₽</p>`;
    });

    vehicleName = "Несколько авто (ограничение по высоте)";
  } else {
    vehicle = selectVehicle(totalWeight, loadingType);
    if (!vehicle) {
      document.getElementById("delivery_result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта</p>";
      return;
    }

    const kmCost = calculateKmCostSmooth(data.deliveryDistance, vehicle.basePerKm, vehicle.minPerKm, vehicle.decay);
    const surcharge = getLoadingSurcharge(vehicle, loadingType);
    deliveryCost = vehicle.minTariff + kmCost + surcharge;

    if (data.underground) deliveryCost += 1500;
    if (data.return_pallets) deliveryCost += 2500;
    if (data.precise_time) deliveryCost += 2500;

    vehicleName = vehicle.name;
    baseLine = `
      <p><strong>Стоимость подачи:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
      <p><strong>Расстояние:</strong> ${data.deliveryDistance.toFixed(2)} км ≈ ${kmCost.toLocaleString()} ₽</p>
      ${surcharge > 0 ? `<p><strong>Надбавка за загрузку (${loadingType}):</strong> ${surcharge.toLocaleString()} ₽</p>` : ""}
      ${data.underground ? `<p>Подземный паркинг: 1 500 ₽</p>` : ""}
      ${data.return_pallets ? `<p>Возврат тары: 2 500 ₽</p>` : ""}
      ${data.precise_time ? `<p>Доставка к точному времени: 2 500 ₽</p>` : ""}
    `;
  }

  moversCost = getMoversCost(data);

  const compactHtml = `
    <p><strong>🚚 Доставка:</strong> ${deliveryCost.toLocaleString()} ₽</p>
    <p><strong>👷 Грузчики:</strong> ${moversCost.toLocaleString()} ₽</p>
    <hr>
    <h3>Итого: ${(deliveryCost + moversCost).toLocaleString()} ₽</h3>
    <p><a href="#" onclick="toggleDetails(event)">Показать подробности</a></p>
    <div id="details_block" style="display:none;">
      <h3>🚚 Расчёт стоимости доставки</h3>
      <p><strong>Транспорт:</strong> ${vehicleName}</p>
      <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
      <p><strong>Тип загрузки:</strong> ${loadingType}</p>
      <p><strong>Расстояние:</strong> ${data.deliveryDistance.toFixed(2)} км</p>
      ${baseLine}
      ${moversCost > 0 ? `<h3>👷 Грузчики:</h3><p>${moversCost.toLocaleString()} ₽</p>` : ""}
    </div>
  `;

  document.getElementById("delivery_result").innerHTML = compactHtml;
  document.getElementById("movers_result").innerHTML = "";
  document.getElementById("total_result").innerHTML = "";
}

function toggleDetails(e) {
  e.preventDefault();
  const block = document.getElementById("details_block");
  const link = e.target;

  if (block.style.display === "block") {
    block.style.display = "none";
    link.textContent = "Показать подробности";
    return;
  }

  block.style.display = "block";
  link.textContent = "Скрыть подробности";
}
