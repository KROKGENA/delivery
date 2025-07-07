<script>
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

const distanceMultipliers = [
  { limit: 60, factor: 1.0 },
  { limit: 100, factor: 0.95 },
  { limit: 150, factor: 0.90 },
  { limit: Infinity, factor: 0.85 }
];

function saveForm() {
  window.formData = {
    weight_standard: parseFloat(document.getElementById('weight_standard').value) || 0,
    weight_large: parseFloat(document.getElementById('weight_large').value) || 0,
    large_format: document.getElementById('large_format').value || "",
    floor: parseInt(document.getElementById('floor').value) || 1,
    lift: document.getElementById('lift').checked,
    only_unload: document.getElementById('only_unload').checked,
    need_movers: document.getElementById('need_movers').checked,
    loading_type: document.getElementById('loading_type').value || "верхняя",
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
  const floor = parseInt(data.floor) || 1;
  const hasLift = data.lift;
  const onlyUnload = data.only_unload;
  const standard = parseFloat(data.weight_standard) || 0;
  const large = parseFloat(data.weight_large) || 0;
  const format = data.large_format || "";
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

  const multiplier = distanceMultipliers.find(m => km <= m.limit).factor;
  perKm *= multiplier;

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

  const distTable = document.createElement("table");
  distTable.innerHTML = `<tr><th>До (км)</th><th>Коэффициент</th></tr>`;
  distanceMultipliers.forEach((d, i) => {
    distTable.innerHTML += `
      <tr>
        <td><input type="number" id="distLimit_${i}" value="${d.limit}" style="width:80px"></td>
        <td><input type="number" id="distFactor_${i}" value="${d.factor}" step="0.01" style="width:60px"></td>
      </tr>
    `;
  });
  panel.innerHTML += "<h4>Коэффициенты на расстояние:</h4>";
  panel.appendChild(distTable);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "💾 Сохранить";
  saveBtn.onclick = () => {
    vehicles.forEach((v, i) => {
      v.minTariff = parseInt(document.getElementById(`minTariff_${i}`).value) || v.minTariff;
      v.perKm = parseInt(document.getElementById(`perKm_${i}`).value) || v.perKm;
    });
    distanceMultipliers.forEach((d, i) => {
      d.limit = parseFloat(document.getElementById(`distLimit_${i}`).value) || d.limit;
      d.factor = parseFloat(document.getElementById(`distFactor_${i}`).value) || d.factor;
    });
    localStorage.setItem("vehicleTariffs", JSON.stringify(vehicles));
    localStorage.setItem("distanceMultipliers", JSON.stringify(distanceMultipliers));
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
    } catch(e) {
      console.warn("Ошибка загрузки тарифов", e);
    }
  }
  const dist = localStorage.getItem("distanceMultipliers");
  if (dist) {
    try {
      const parsed = JSON.parse(dist);
      if (Array.isArray(parsed)) {
        parsed.forEach((d, i) => {
          if (distanceMultipliers[i]) {
            distanceMultipliers[i].limit = d.limit;
            distanceMultipliers[i].factor = d.factor;
          }
        });
      }
    } catch(e) {
      console.warn("Ошибка загрузки коэффициентов", e);
    }
  }
})();
</script>
