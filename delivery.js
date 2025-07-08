let vehicles = [];

async function loadTariffs() {
  try {
    const response = await fetch("data/tariffs.json");
    const json = await response.json();
    vehicles = json.map((v) => ({
      ...v,
      maxWeight: getMaxWeightFromName(v.name),
      loadingTypes: getLoadingTypesFromName(v.name)
    }));
  } catch (e) {
    console.error("Не удалось загрузить тарифы:", e);
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
  const excessKm = Math.max(0, distance - 40);
  let cost = 0;
  for (let km = 1; km <= excessKm; km++) {
    const rate = minRate + (baseRate - minRate) * Math.exp(-decay * km);
    cost += rate;
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
    await loadTariffs(); // Ждём загрузку, если ещё не загружено
  }

  // ...дальше как есть
}

function calculateDelivery() {
  if (!window.formData) {
    alert("Сначала сохраните параметры");
    return;
  }

  const data = window.formData;
  const totalWeight = (data.weight_standard || 0) + (data.weight_large || 0);
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
      const dist = Math.max(0, data.deliveryDistance - 40);
      deliveryCost += v.minTariff + calculateKmCostSmooth(dist, v.basePerKm, v.minPerKm, v.decay) + getLoadingSurcharge(v, data.loading_type);
      baseLine += `<p>🚚 ${v.name}: ${v.minTariff.toLocaleString()} ₽</p>`;
    });

    vehicleName = "Несколько авто (ограничение по высоте)";
  } else {
    vehicle = selectVehicle(totalWeight, data.loading_type);
    if (!vehicle) {
      document.getElementById("delivery_result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта</p>";
      return;
    }

    const extraKm = Math.max(0, data.deliveryDistance - 40);
    const surcharge = getLoadingSurcharge(vehicle, data.loading_type);
    const kmCost = calculateKmCostSmooth(extraKm, vehicle.basePerKm, vehicle.minPerKm, vehicle.decay);
    deliveryCost = vehicle.minTariff + kmCost + surcharge;

    if (data.return_pallets) deliveryCost += 2500;
    if (data.precise_time) deliveryCost += 2500;

    vehicleName = vehicle.name;
    baseLine = `
      <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
      <p><strong>Доп. км:</strong> ${extraKm.toFixed(2)} км ≈ ${kmCost.toLocaleString()} ₽</p>
      ${surcharge > 0 ? `<p><strong>Надбавка за загрузку (${data.loading_type}):</strong> ${surcharge.toLocaleString()} ₽</p>` : ""}
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
      <p><strong>Тип загрузки:</strong> ${data.loading_type}</p>
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

  const correctPassword = "2025";
  const entered = prompt("Введите пароль для просмотра подробностей:");
  if (entered === correctPassword) {
    block.style.display = "block";
    link.textContent = "Скрыть подробности";
  } else {
    alert("Неверный пароль");
  }
}

function openAdmin() {
  const pw = prompt("Введите админ-пароль:");
  if (pw !== "2025") {
    alert("Неверный пароль");
    return;
  }

  const panel = document.getElementById("admin_panel");
  panel.innerHTML = "<h3>⚙️ Редактирование тарифов</h3>";
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <tr>
      <th>Транспорт</th>
      <th>Базовый тариф (₽)</th>
      <th>₽/км начальный</th>
      <th>₽/км минимальный</th>
      <th>Скорость убывания (decay)</th>
    </tr>
  `;

  vehicles.forEach((v, i) => {
    table.innerHTML += `
      <tr>
        <td>${v.name}</td>
        <td><input type="number" id="minTariff_${i}" value="${v.minTariff}" style="width:80px"></td>
        <td><input type="number" id="basePerKm_${i}" value="${v.basePerKm}" style="width:80px"></td>
        <td><input type="number" id="minPerKm_${i}" value="${v.minPerKm}" style="width:80px"></td>
        <td><input type="number" step="0.001" id="decay_${i}" value="${v.decay}" style="width:80px"></td>
      </tr>
    `;
  });

  panel.appendChild(table);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾 Сохранить";
  saveBtn.style.marginTop = "10px";
  saveBtn.onclick = () => {
    vehicles.forEach((v, i) => {
      v.minTariff = parseInt(document.getElementById(`minTariff_${i}`).value) || v.minTariff;
      v.basePerKm = parseFloat(document.getElementById(`basePerKm_${i}`).value) || v.basePerKm;
      v.minPerKm = parseFloat(document.getElementById(`minPerKm_${i}`).value) || v.minPerKm;
      v.decay = parseFloat(document.getElementById(`decay_${i}`).value) || v.decay;
    });
    localStorage.setItem("vehicleTariffs", JSON.stringify(vehicles));
    alert("Сохранено!");
  };

  panel.appendChild(saveBtn);
  panel.style.display = "block";
}

(function loadSavedTariffs() {
  const saved = localStorage.getItem("vehicleTariffs");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((v, i) => {
          if (vehicles[i]) {
            vehicles[i].minTariff = v.minTariff;
            vehicles[i].basePerKm = v.basePerKm;
            vehicles[i].minPerKm = v.minPerKm;
            vehicles[i].decay = v.decay;
          }
        });
      }
    } catch (e) {
      console.warn("Ошибка загрузки тарифов", e);
    }
  }
})();
