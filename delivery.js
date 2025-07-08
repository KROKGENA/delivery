// 🚚 Обновлённый список с плавным тарифом
const vehicles = [
  { name: "а/м до 1т", maxWeight: 1000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 4000, basePerKm: 100, minPerKm: 60, decay: 0.015 },
  { name: "а/м до 1.5т", maxWeight: 1500, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 4000, basePerKm: 100, minPerKm: 60, decay: 0.015 },
  { name: "а/м до 3т", maxWeight: 3000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 4500, basePerKm: 115, minPerKm: 70, decay: 0.012 },
  { name: "а/м 5т", maxWeight: 5000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 5000, basePerKm: 144, minPerKm: 90, decay: 0.012 },
  { name: "а/м 5т гидролифт", maxWeight: 5000, loadingTypes: ["гидролифт"], minTariff: 6000, basePerKm: 154, minPerKm: 100, decay: 0.012 },
  { name: "а/м 10т", maxWeight: 10000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 8000, basePerKm: 210, minPerKm: 130, decay: 0.01 },
  { name: "Еврофура 20т", maxWeight: 20000, loadingTypes: ["верхняя", "боковая", "любая"], minTariff: 10000, basePerKm: 250, minPerKm: 160, decay: 0.01 },
  { name: "Манипулятор 5т", maxWeight: 5000, loadingTypes: ["manipulator"], minTariff: 15000, basePerKm: 240, minPerKm: 200, decay: 0.01 },
  { name: "Манипулятор 10т", maxWeight: 10000, loadingTypes: ["manipulator"], minTariff: 20000, basePerKm: 240, minPerKm: 200, decay: 0.01 },
  { name: "Манипулятор 15т", maxWeight: 15000, loadingTypes: ["manipulator"], minTariff: 25000, basePerKm: 240, minPerKm: 200, decay: 0.01 }
];

function selectVehicle(weight, loadingType) {
  return vehicles.find(v => v.maxWeight >= weight && v.loadingTypes.includes(loadingType));
}

function calculateKmCostSmooth(distance, baseRate, minRate, decay = 0.01) {
  let cost = 0;
  for (let km = 0.1; km <= distance; km += 0.1) {
    const rawRate = minRate + (baseRate - minRate) * Math.exp(-decay * km);
    const rate = Math.max(minRate, rawRate);
    cost += rate * 0.1;
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
    if (isOnlyUnload) total += large * 20;
    else if (liftAllowed && hasLift) total += large * 30;
    else {
      const rate = floor <= 5 ? 50 : floor <= 10 ? 60 : floor <= 20 ? 70 : 90;
      total += large * rate;
    }
  }

  if (standard > 0) {
    if (isOnlyUnload) total += standard * 7;
    else if (hasLift) total += standard * 9;
    else {
      const rate = floor <= 5 ? 15 : floor <= 10 ? 20 : floor <= 20 ? 30 : 50;
      total += standard * rate;
    }
  }

  return total;
}

function loadTariffsFromGitHub() {
  fetch('https://raw.githubusercontent.com/KROKGENA/delivery/main/data/tariffs.json')
    .then(res => res.json())
    .then(data => {
      data.forEach((v, i) => {
        if (vehicles[i]) {
          vehicles[i].minTariff = v.minTariff;
          vehicles[i].basePerKm = v.basePerKm;
          vehicles[i].minPerKm = v.minPerKm;
          vehicles[i].decay = v.decay;
        }
      });
      console.log('✅ Тарифы загружены с GitHub');
    })
    .catch(e => {
      console.warn('❌ Ошибка при загрузке тарифов с GitHub, fallback на localStorage', e);
      loadSavedTariffs();
    });
}

function loadSavedTariffs() {
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
        console.log("📦 Тарифы загружены из localStorage");
      }
    } catch (e) {
      console.warn("Ошибка загрузки тарифов из localStorage", e);
    }
  }
}

function resetTariffsToGitHub() {
  localStorage.removeItem("vehicleTariffs");
  loadTariffsFromGitHub();
  alert("🔄 Тарифы сброшены до версии GitHub и перезагружены");
}

function openAdmin() {
  const pw = prompt("Введите админ-пароль:");
  if (pw !== "2025") return alert("Неверный пароль");
  const panel = document.getElementById("admin_panel");
  panel.innerHTML = "<h3>⚙️ Редактирование тарифов</h3>";
  const table = document.createElement("table");
  table.innerHTML = `<tr>
    <th>Транспорт</th><th>Базовый тариф</th><th>₽/км нач</th><th>₽/км мин</th><th>decay</th>
  </tr>`;
  vehicles.forEach((v, i) => {
    table.innerHTML += `<tr>
      <td>${v.name}</td>
      <td><input type="number" id="minTariff_${i}" value="${v.minTariff}" style="width:70px"></td>
      <td><input type="number" id="basePerKm_${i}" value="${v.basePerKm}" style="width:70px"></td>
      <td><input type="number" id="minPerKm_${i}" value="${v.minPerKm}" style="width:70px"></td>
      <td><input type="number" step="0.001" id="decay_${i}" value="${v.decay}" style="width:70px"></td>
    </tr>`;
  });
  panel.appendChild(table);
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "📏 Сохранить";
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

// Запускаем загрузку с GitHub при старте
loadTariffsFromGitHub();
