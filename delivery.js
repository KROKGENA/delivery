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

function showResult(distance) {
  const inside = distance <= 40;
  const outsideKm = inside ? 0 : (distance - 40).toFixed(2);
  window.deliveryDistance = parseFloat(distance.toFixed(2));
  window.extraDistance = parseFloat(outsideKm);

  if (window.formData) {
    window.formData.deliveryDistance = parseFloat(distance.toFixed(2));
    window.formData.extraDistance = Math.max(0, distance - 40);
  }
}

function calculateKmCostSmooth(distance, baseRate, minRate, decay = 0.01) {
  let cost = 0;
  for (let km = 0.1; km <= distance; km += 0.1) {
    const rate = minRate + (baseRate - minRate) * Math.exp(-decay * km);
    cost += rate * 0.1;
  }
  return Math.round(cost);
}

function loadTariffsFromGitHub() {
  fetch("https://raw.githubusercontent.com/KROKGENA/delivery/main/data/tariffs.json")
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data)) {
        data.forEach((t, i) => {
          if (vehicles[i]) {
            vehicles[i].minTariff = t.minTariff;
            vehicles[i].basePerKm = t.basePerKm;
            vehicles[i].minPerKm = t.minPerKm;
            vehicles[i].decay = t.decay;
          }
        });
        console.log("✅ Тарифы загружены с GitHub");
      }
    })
    .catch(e => console.warn("❌ Ошибка загрузки тарифов", e));
}

function selectVehicle(weight, loadingType) {
  return vehicles.find(v => v.maxWeight >= weight && v.loadingTypes.includes(loadingType));
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

function calculateDelivery() {
  if (!window.formData) return alert("Сначала сохраните параметры");

  const data = window.formData;
  const totalWeight = (data.weight_standard || 0) + (data.weight_large || 0);
  let deliveryCost = 0, moversCost = 0, vehicleName = "", baseLine = "";

  if (data.underground && data.height_limit && parseFloat(data.height_limit) < 2.2) {
    let left = totalWeight, parts = [];
    while (left > 0) {
      if (left > 1500) { parts.push(1500); left -= 1500; }
      else if (left > 1000) { parts.push(1000); parts.push(left - 1000); break; }
      else { parts.push(left); break; }
    }
    parts.forEach(w => {
      const v = selectVehicle(w, "верхняя");
      if (!v) return;
      const dist = data.deliveryDistance;
      deliveryCost += v.minTariff + calculateKmCostSmooth(dist, v.basePerKm, v.minPerKm, v.decay) + getLoadingSurcharge(v, data.loading_type);
      baseLine += `<p>🚚 ${v.name}: ${v.minTariff.toLocaleString()} ₽</p>`;
    });
    vehicleName = "Несколько авто (ограничение по высоте)";
  } else {
    const vehicle = selectVehicle(totalWeight, data.loading_type);
    if (!vehicle) {
      document.getElementById("delivery_result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта</p>";
      return;
    }
    const dist = data.deliveryDistance;
    const kmCost = calculateKmCostSmooth(dist, vehicle.basePerKm, vehicle.minPerKm, vehicle.decay);
    const surcharge = getLoadingSurcharge(vehicle, data.loading_type);
    deliveryCost = vehicle.minTariff + kmCost + surcharge;
    if (data.return_pallets) deliveryCost += 2500;
    if (data.precise_time) deliveryCost += 2500;
    vehicleName = vehicle.name;
    baseLine = `
      <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
      <p><strong>Доп. км:</strong> ${dist.toFixed(2)} км ≈ ${kmCost.toLocaleString()} ₽</p>
      ${surcharge ? `<p><strong>Надбавка за загрузку (${data.loading_type}):</strong> ${surcharge.toLocaleString()} ₽</p>` : ""}
      ${data.return_pallets ? `<p>Возврат тары: 2 500 ₽</p>` : ""}
      ${data.precise_time ? `<p>Доставка к точному времени: 2 500 ₽</p>` : ""}`;
  }

  moversCost = getMoversCost(data);

  const html = `
    <p><strong>🚚 Доставка:</strong> ${deliveryCost.toLocaleString()} ₽</p>
    <p><strong>👷 Грузчики:</strong> ${moversCost.toLocaleString()} ₽</p>
    <hr><h3>Итого: ${(deliveryCost + moversCost).toLocaleString()} ₽</h3>
    <p><a href="#" onclick="toggleDetails(event)">Показать подробности</a></p>
    <div id="details_block" style="display:none;">
      <h3>🚚 Расчёт стоимости доставки</h3>
      <p><strong>Транспорт:</strong> ${vehicleName}</p>
      <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
      <p><strong>Тип загрузки:</strong> ${data.loading_type}</p>
      <p><strong>Расстояние:</strong> ${data.deliveryDistance.toFixed(2)} км</p>
      ${baseLine}
      ${moversCost > 0 ? `<h3>👷 Грузчики:</h3><p>${moversCost.toLocaleString()} ₽</p>` : ""}
    </div>`;

  document.getElementById("delivery_result").innerHTML = html;
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
  } else {
    const entered = prompt("Введите пароль для просмотра подробностей:");
    if (entered === "2025") {
      block.style.display = "block";
      link.textContent = "Скрыть подробности";
    } else alert("Неверный пароль");
  }
}

// Запускаем загрузку с GitHub при старте
loadTariffsFromGitHub();
