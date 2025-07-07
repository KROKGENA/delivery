const vehicles = [
  { name: "а/м до 1т", maxWeight: 1000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 4000, perKm: 100 },
  { name: "а/м до 1.5т", maxWeight: 1500, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 4000, perKm: 100 },
  { name: "а/м до 3т", maxWeight: 3000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 4500, perKm: 115 },
  { name: "а/м 5т", maxWeight: 5000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 5000, perKm: 144 },
  { name: "а/м 5т гидролифт", maxWeight: 5000, loadingTypes: ["гидролифт"], minTariff: 6000, perKm: 154 },
  { name: "а/м 10т", maxWeight: 10000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 8000, perKm: 210 },
  { name: "Еврофура 20т", maxWeight: 20000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 10000, perKm: 250 },
  { name: "Манипулятор 5т", maxWeight: 5000, loadingTypes: ["manipulator"], minTariff: 15000, perKm: 240 },
  { name: "Манипулятор 10т", maxWeight: 10000, loadingTypes: ["manipulator"], minTariff: 20000, perKm: 240 },
  { name: "Манипулятор 15т", maxWeight: 15000, loadingTypes: ["manipulator"], minTariff: 25000, perKm: 240 }
];

function selectVehicle(weight, loadingType) {
  return vehicles.find(v => v.maxWeight >= weight && v.loadingTypes.includes(loadingType));
}

function getLoadingSurcharge(vehicle, loadingType) {
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
      deliveryCost += v.minTariff + dist * v.perKm + getLoadingSurcharge(v, data.loading_type);
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
    deliveryCost = vehicle.minTariff + extraKm * vehicle.perKm + surcharge;

    if (data.return_pallets) deliveryCost += 2500;
    if (data.precise_time) deliveryCost += 2500;

    vehicleName = vehicle.name;
    baseLine = `
      <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
      <p><strong>Доп. км:</strong> ${extraKm.toFixed(2)} км × ${vehicle.perKm} ₽ = ${(extraKm * vehicle.perKm).toLocaleString()} ₽</p>
      <p><strong>Надбавка за загрузку (${data.loading_type}):</strong> ${surcharge.toLocaleString()} ₽</p>
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

  const correctPassword = "2024";
  const entered = prompt("Введите пароль для просмотра подробностей:");
  if (entered === correctPassword) {
    block.style.display = "block";
    link.textContent = "Скрыть подробности";
  } else {
    alert("Неверный пароль");
  }
}
// === 📌 Фикс: если "любая", надбавка не начисляется
function getLoadingSurcharge(vehicle, loadingType) {
  if (loadingType === "любая") return 0;
  const wt = vehicle.maxWeight;
  if (wt <= 3000) return 1500;
  if (wt === 5000) return loadingType === "боковая" ? 2000 : 2500;
  if (wt === 10000) return loadingType === "боковая" ? 2500 : 3000;
  if (wt === 20000) return loadingType === "боковая" ? 3000 : 3500;
  return 0;
}

// === ⚙️ Админка
function openAdmin() {
  const pw = prompt("Введите админ-пароль:");
  if (pw !== "admin2024") {
    alert("Неверный пароль");
    return;
  }

  const panel = document.getElementById("admin_panel");
  panel.innerHTML = "<h3>⚙️ Редактирование тарифов</h3>";
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.innerHTML = `
    <tr><th style="text-align:left">Транспорт</th><th>Базовый тариф (₽)</th><th>₽/км</th></tr>
  `;

  vehicles.forEach((v, i) => {
    table.innerHTML += `
      <tr>
        <td>${v.name}</td>
        <td><input type="number" id="minTariff_${i}" value="${v.minTariff}" style="width:80px"></td>
        <td><input type="number" id="perKm_${i}" value="${v.perKm}" style="width:60px"></td>
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
      v.perKm = parseInt(document.getElementById(`perKm_${i}`).value) || v.perKm;
    });
    localStorage.setItem("vehicleTariffs", JSON.stringify(vehicles));
    alert("Сохранено!");
  };

  panel.appendChild(saveBtn);
  panel.style.display = "block";
}

// === 🚀 Автозагрузка тарифов при старте
(function loadSavedTariffs() {
  const saved = localStorage.getItem("vehicleTariffs");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((v, i) => {
          if (vehicles[i]) {
            vehicles[i].minTariff = v.minTariff;
            vehicles[i].perKm = v.perKm;
          }
        });
      }
    } catch (e) {
      console.warn("Ошибка загрузки тарифов", e);
    }
  }
})();
