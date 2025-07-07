<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Калькулятор доставки плитки</title>
  <style>
    table td, table th { padding: 4px; }
  </style>
</head>
<body>
  <h1>Калькулятор доставки</h1>

  <form id="deliveryForm">
    <fieldset>
      <legend>Параметры доставки</legend>
      Вес стандартной плитки (кг): <input type="number" id="weight_standard" min="0">
      Вес крупной плитки (кг): <input type="number" id="weight_large" min="0"><br>

      Формат крупной плитки:
      <select id="large_format">
        <option value="100x200">100x200</option>
        <option value="100x260">100x260</option>
        <option value="100x280">100x280</option>
        <option value="custom">Другое</option>
      </select>
      <br>

      Этаж: <input type="number" id="floor" min="1" value="1">
      <label><input type="checkbox" id="lift"> Есть лифт</label><br>
      <label><input type="checkbox" id="only_unload"> Только выгрузка</label>
      <label><input type="checkbox" id="need_movers"> Нужны грузчики</label><br>

      Тип загрузки:
      <select id="loading_type">
        <option value="верхняя">Верхняя</option>
        <option value="боковая">Боковая</option>
        <option value="гидролифт">Гидролифт</option>
        <option value="manipulator">Манипулятор</option>
        <option value="любая">Любая</option>
      </select><br>

      Расстояние (км): <input type="number" id="distance" min="0"><br>
      <label><input type="checkbox" id="return_pallets"> Возврат тары</label>
      <label><input type="checkbox" id="precise_time"> Доставка к точному времени</label>
    </fieldset>

    <button type="button" onclick="saveForm()">Сохранить параметры</button>
    <button type="button" onclick="calculateDelivery()">Рассчитать стоимость</button>
    <button onclick="openAdmin()" type="button">⚙️ Админка</button>
  </form>

  <div id="delivery_result" style="margin-top: 20px;"></div>
  <div id="admin_panel" style="margin-top:20px;"></div>

<script>
let kmDiscounts = [
  { from: 0, to: 60, coeff: 1 },
  { from: 60, to: 100, coeff: 0.95 },
  { from: 100, to: 150, coeff: 0.9 },
  { from: 150, to: Infinity, coeff: 0.85 },
];

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

function saveForm() {
  window.formData = {
    weight_standard: +document.getElementById('weight_standard').value || 0,
    weight_large: +document.getElementById('weight_large').value || 0,
    large_format: document.getElementById('large_format').value,
    floor: parseInt(document.getElementById('floor').value) || 1,
    lift: document.getElementById('lift').checked,
    only_unload: document.getElementById('only_unload').checked,
    need_movers: document.getElementById('need_movers').checked,
    loading_type: document.getElementById('loading_type').value,
    distance: parseFloat(document.getElementById('distance').value) || 0,
    return_pallets: document.getElementById('return_pallets').checked,
    precise_time: document.getElementById('precise_time').checked
  };
  alert("Параметры сохранены");
}

function getLoadingSurcharge(vehicle, type) {
  if (type === "любая") return 0;
  if (vehicle.maxWeight <= 3000) return 1500;
  if (vehicle.maxWeight === 5000) return type === "боковая" ? 2000 : 2500;
  if (vehicle.maxWeight === 10000) return type === "боковая" ? 2500 : 3000;
  if (vehicle.maxWeight === 20000) return type === "боковая" ? 3000 : 3500;
  return 0;
}

function getMoversCost(data) {
  if (!data.need_movers) return 0;
  const floor = data.floor;
  const hasLift = data.lift;
  const onlyUnload = data.only_unload;
  const standard = data.weight_standard;
  const large = data.weight_large;
  const format = data.large_format;
  let cost = 0;

  if (large > 0) {
    const liftAllowed = ["100x200", "100x260", "100x280"].includes(format);
    if (onlyUnload) cost += large * 20;
    else if (liftAllowed && hasLift) cost += large * 30;
    else {
      const rate = floor <= 5 ? 50 : floor <= 10 ? 60 : floor <= 20 ? 70 : 90;
      cost += large * rate;
    }
  }

  if (standard > 0) {
    if (onlyUnload) cost += standard * 7;
    else if (hasLift) cost += standard * 9;
    else {
      const rate = floor <= 5 ? 15 : floor <= 10 ? 20 : floor <= 20 ? 30 : 50;
      cost += standard * rate;
    }
  }

  return cost;
}

function selectVehicle(weight, type) {
  return vehicles.find(v => v.maxWeight >= weight && v.loadingTypes.includes(type));
}

function calculateDelivery() {
  const data = window.formData;
  if (!data) return alert("Сначала сохраните параметры");

  const totalWeight = data.weight_standard + data.weight_large;
  const vehicle = selectVehicle(totalWeight, data.loading_type);
  if (!vehicle) return alert("Нет подходящего транспорта");

  const baseTariff = vehicle.minTariff;
  let perKm = vehicle.perKm;
  const km = Math.max(0, data.distance - 40);

  for (let i = 0; i < kmDiscounts.length; i++) {
    const rule = kmDiscounts[i];
    if (km >= rule.from && km < rule.to) {
      perKm *= rule.coeff;
      break;
    }
  }

  const kmCost = km * perKm;
  const loadSurcharge = getLoadingSurcharge(vehicle, data.loading_type);
  const pallets = data.return_pallets ? 2500 : 0;
  const exactTime = data.precise_time ? 2500 : 0;
  const movers = getMoversCost(data);

  const total = baseTariff + kmCost + loadSurcharge + pallets + exactTime + movers;

  document.getElementById("delivery_result").innerHTML = `
    <h3>Итого: ${total.toLocaleString()} ₽</h3>
    <p><strong>Транспорт:</strong> ${vehicle.name}</p>
    <p><strong>Базовый тариф:</strong> ${baseTariff.toLocaleString()} ₽</p>
    <p><strong>Доп. км:</strong> ${km.toFixed(2)} × ${perKm.toFixed(0)} ₽ = ${kmCost.toLocaleString()} ₽</p>
    ${loadSurcharge > 0 ? `<p>Надбавка за загрузку: ${loadSurcharge.toLocaleString()} ₽</p>` : ""}
    ${data.return_pallets ? `<p>Возврат тары: 2 500 ₽</p>` : ""}
    ${data.precise_time ? `<p>Доставка к точному времени: 2 500 ₽</p>` : ""}
    ${movers > 0 ? `<p>Грузчики: ${movers.toLocaleString()} ₽</p>` : ""}
  `;
}

function openAdmin() {
  const pw = prompt("Введите админ-пароль:");
  if (pw !== "admin2024") return alert("Неверный пароль");

  const panel = document.getElementById("admin_panel");
  panel.innerHTML = "<h3>⚙️ Редактирование тарифов</h3>";
  const table = document.createElement("table");
  table.innerHTML = `
    <tr><th>Транспорт</th><th>Базовый тариф (₽)</th><th>₽/км</th></tr>
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

  const kmTable = document.createElement("table");
  kmTable.innerHTML = `<tr><th>От (км)</th><th>До (км)</th><th>Коэффициент</th></tr>`;
  kmDiscounts.forEach((r, i) => {
    kmTable.innerHTML += `
      <tr>
        <td><input type="number" id="from_${i}" value="${r.from}" style="width:60px"></td>
        <td><input type="number" id="to_${i}" value="${r.to === Infinity ? '' : r.to}" style="width:60px"></td>
        <td><input type="number" step="0.01" id="coeff_${i}" value="${r.coeff}" style="width:60px"></td>
      </tr>
    `;
  });
  panel.innerHTML += "<h3>Скидки на расстояние</h3>";
  panel.appendChild(kmTable);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾 Сохранить";
  saveBtn.onclick = () => {
    vehicles.forEach((v, i) => {
      v.minTariff = parseInt(document.getElementById(`minTariff_${i}`).value) || v.minTariff;
      v.perKm = parseInt(document.getElementById(`perKm_${i}`).value) || v.perKm;
    });
    kmDiscounts = kmDiscounts.map((r, i) => ({
      from: parseFloat(document.getElementById(`from_${i}`).value),
      to: parseFloat(document.getElementById(`to_${i}`).value) || Infinity,
      coeff: parseFloat(document.getElementById(`coeff_${i}`).value)
    }));
    localStorage.setItem("vehicleTariffs", JSON.stringify(vehicles));
    localStorage.setItem("kmDiscounts", JSON.stringify(kmDiscounts));
    alert("Сохранено!");
  };
  panel.appendChild(saveBtn);
}

(function loadTariffs() {
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
    } catch(e) { console.warn("Ошибка загрузки тарифов", e); }
  }
  const discountSaved = localStorage.getItem("kmDiscounts");
  if (discountSaved) {
    try {
      const parsed = JSON.parse(discountSaved);
      if (Array.isArray(parsed)) kmDiscounts = parsed;
    } catch(e) { console.warn("Ошибка загрузки скидок", e); }
  }
})();
</script>
</body>
</html>
