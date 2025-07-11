let vehicles = [];

async function loadTariffs(forceReloadFromGit = false) {
  try {
    const basePath = location.pathname.includes("/delivery/") ? "/delivery/" : "/";
    const saved = localStorage.getItem("custom_tariffs");

    let json;
    if (saved && !forceReloadFromGit) {
      vehicles = JSON.parse(saved);
      console.log("✅ Загружено из localStorage");
    } else {
      const response = await fetch(`${basePath}data/tariffs.json?nocache=${Date.now()}`);
      json = await response.json();
      vehicles = json;
      localStorage.setItem("custom_tariffs", JSON.stringify(json));
      console.log("✅ Загружено с GitHub");
    }

    vehicles = vehicles.map((v) => ({
      ...v,
      maxWeight: getMaxWeightFromName(v.name),
      loadingTypes: getLoadingTypesFromName(v.name)
    })).sort((a, b) => a.maxWeight - b.maxWeight);
  } catch (e) {
    console.error("❌ Не удалось загрузить тарифы:", e);
    alert("Ошибка загрузки тарифов: " + e.message);
  }
}

function getMaxWeightFromName(name) {
  const lowered = name.toLowerCase();

  const patterns = new Map([
    [/манипулятор 15т/, 15000],
    [/манипулятор 10т/, 10000],
    [/манипулятор 5т/, 5000],
    [/еврофура/, 20000],
    [/\b20т\b/, 20000],
    [/\b15т\b/, 15000],
    [/\b10т\b/, 10000],
    [/\b5т\b/, 5000],
    [/\b3т\b/, 3000],
    [/\b1\.5т\b/, 1500],
    [/\b1т\b/, 1000]
  ]);

  for (const [regex, weight] of patterns) {
    if (regex.test(lowered)) return weight;
  }

  return 0;
}

function getLoadingTypesFromName(name) {
  const lowered = name.toLowerCase();

  const loadingMap = new Map([
    [/гидролифт/, ["гидролифт"]],
    [/манипулятор/, ["manipulator"]]
  ]);

  for (const [regex, types] of loadingMap) {
    if (regex.test(lowered)) return types;
  }

  return ["верхняя", "боковая", "любая"];
}

function selectVehicle(weight, loadingType) {
  const suitableByWeight = vehicles.filter(v => v.maxWeight >= weight);
  if (suitableByWeight.length === 0) {
    console.warn("❌ Нет машин, способных перевезти вес:", weight);
    return null;
  }

  const exactMatch = suitableByWeight.find(v => v.loadingTypes.includes(loadingType));
  return exactMatch || suitableByWeight[0];
}

function calculateKmCostSmooth(distance, baseRate, minRate, decay = 0.01) {
  const step = 0.1;
  let total = 0;
  for (let km = 0; km < distance; km += step) {
    const rate = minRate + (baseRate - minRate) * Math.exp(-decay * km);
    total += rate * step;
  }
  return Math.round(total);
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

function getMoversCost(data) {
  if (!data.need_movers) return 0;

  const floor = parseInt(data.floor || 1);
  const hasLift = data.lift === "true";
  const onlyUnload = data.only_unload === "true";
  const standard = data.weight_standard || 0;
  const large = data.weight_large || 0;
  const format = data.large_format || "";

  let total = 0;

  if (large > 0) {
    const liftOk = ["100x200", "100x260", "100x280"].includes(format);
    if (onlyUnload) {
      total += large * 20;
    } else if (liftOk && hasLift) {
      total += large * 30;
    } else {
      const rate = floor <= 5 ? 50 : floor <= 10 ? 60 : floor <= 20 ? 70 : 90;
      total += large * rate;
    }
  }

  if (standard > 0) {
    if (onlyUnload) {
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
  if (vehicles.length === 0) await loadTariffs();
  if (!window.formData) return alert("Сначала сохраните параметры");

  const data = window.formData;
  const totalWeight = (data.weight_standard || 0) + (data.weight_large || 0);
  const loadingType = data.loading_type || "любая";
  let deliveryCost = 0;
  let moversCost = 0;
  let vehicleName = "";
  let details = "";

  if (data.underground && parseFloat(data.height_limit) < 2.2) {
    let left = totalWeight;
    const parts = [];

    while (left > 0) {
      const chunk = Math.min(left, 1500);
      parts.push(chunk);
      left -= chunk;
    }

    for (const weight of parts) {
      const v = selectVehicle(weight, "верхняя");
      if (!v) continue;
      const kmCost = calculateKmCostSmooth(data.deliveryDistance, v.basePerKm, v.minPerKm, v.decay);
      const surcharge = getLoadingSurcharge(v, "верхняя");
      deliveryCost += v.minTariff + kmCost + surcharge;
      details += `<p>🚚 ${v.name} (${weight} кг): ${v.minTariff} ₽ + ${kmCost} ₽ + ${surcharge} ₽</p>`;
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
      ${surcharge > 0 ? `<p>Надбавка (${loadingType}): ${surcharge} ₽</p>` : ""}
      ${data.underground ? `<p>Паркинг: 1500 ₽</p>` : ""}
      ${data.return_pallets ? `<p>Возврат тары: 2500 ₽</p>` : ""}
      ${data.precise_time ? `<p>Ко времени: 2500 ₽</p>` : ""}
    `;
  }

  moversCost = getMoversCost(data);

  const resultHTML = `
    <p><strong>🚚 Доставка:</strong> ${deliveryCost.toLocaleString()} ₽</p>
    <p><strong>👷 Грузчики:</strong> ${moversCost.toLocaleString()} ₽</p>
    <hr>
    <h3>Итого: ${(deliveryCost + moversCost).toLocaleString()} ₽</h3>
    <p><a href="#" onclick="toggleDetails(event)">Показать подробности</a></p>
    <div id="details_block" style="display:none;">
      <h3>Подробности доставки</h3>
      <p><strong>Транспорт:</strong> ${vehicleName}</p>
      <p><strong>Вес:</strong> ${totalWeight} кг</p>
      ${details}
      ${moversCost > 0 ? `<h3>Грузчики:</h3><p>${moversCost.toLocaleString()} ₽</p>` : ""}
    </div>
  `;

  document.getElementById("delivery_result").innerHTML = resultHTML;
  document.getElementById("movers_result").innerHTML = "";
  document.getElementById("total_result").innerHTML = "";
}

function toggleDetails(e) {
  e.preventDefault();
  const block = document.getElementById("details_block");
  const link = e.target;
  block.style.display = block.style.display === "block" ? "none" : "block";
  link.textContent = block.style.display === "block" ? "Скрыть подробности" : "Показать подробности";
}

function openAdminPanel() {
  if (vehicles.length === 0) {
    alert("Сначала загрузите тарифы");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999;padding:20px;overflow:auto;";
  wrapper.id = "admin_panel";

  wrapper.innerHTML = `
    <h2>⚙️ Админка тарифов</h2>
    <p>Измените параметры и нажмите "Сохранить"</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;max-width:900px">
      <thead>
        <tr>
          <th>Машина</th>
          <th>Мин. тариф (₽)</th>
          <th>₽/км начальный</th>
          <th>₽/км мин</th>
          <th>Коэф. убывания</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map((v, i) => `
          <tr>
            <td>${v.name}</td>
            <td><input type="number" value="${v.minTariff}" id="minTariff_${i}"></td>
            <td><input type="number" value="${v.basePerKm}" id="basePerKm_${i}"></td>
            <td><input type="number" value="${v.minPerKm}" id="minPerKm_${i}"></td>
            <td><input type="number" value="${v.decay}" step="0.001" id="decay_${i}"></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <br>
    <button onclick="saveAdminTariffs()">💾 Сохранить</button>
    <button onclick="loadFromGit()">🔄 Загрузить с Git</button>
    <button onclick="closeAdminPanel()">❌ Закрыть</button>
  `;

  document.body.appendChild(wrapper);
}

function closeAdminPanel() {
  const panel = document.getElementById("admin_panel");
  if (panel) panel.remove();
}

function saveAdminTariffs() {
  vehicles.forEach((v, i) => {
    v.minTariff = parseInt(document.getElementById(`minTariff_${i}`).value);
    v.basePerKm = parseFloat(document.getElementById(`basePerKm_${i}`).value);
    v.minPerKm = parseFloat(document.getElementById(`minPerKm_${i}`).value);
    v.decay = parseFloat(document.getElementById(`decay_${i}`).value);
  });

  localStorage.setItem("custom_tariffs", JSON.stringify(vehicles));
  alert("Тарифы обновлены!");
  closeAdminPanel();
}

async function loadFromGit() {
  await loadTariffs(true);
  alert("Загружено с Git и сброшено локальное");
  closeAdminPanel();
}
