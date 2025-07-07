// delivery.js

// 🚚 Список автомобилей
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

// 🔍 Поиск транспорта
function selectVehicle(totalWeight, loadingType, forceMaxWeight = null) {
  return vehicles.find(v =>
    v.loadingTypes.includes(loadingType) &&
    (forceMaxWeight ? v.maxWeight <= forceMaxWeight : v.maxWeight >= totalWeight)
  );
}

// 💸 Надбавка за тип загрузки (по типу авто и загрузке)
function getLoadingSurcharge(vehicle, loadingType) {
  if (loadingType !== "верхняя" && loadingType !== "боковая") return 0;

  const name = vehicle.name;

  if (name.includes("до 1т") || name.includes("до 1.5т") || name.includes("до 3т")) return 1500;
  if (name.includes("5т") && !name.includes("гидролифт")) return loadingType === "верхняя" ? 2500 : 2000;
  if (name.includes("10т")) return loadingType === "верхняя" ? 3000 : 2500;
  if (name.includes("20т") || name.includes("Еврофура")) return loadingType === "верхняя" ? 3500 : 3000;

  return 0;
}

// 🧮 Расчёт доставки
function calculateDelivery() {
  if (!window.formData) {
    alert("Сначала сохраните параметры");
    return;
  }

  const data = window.formData;
  const totalWeight = data.weight_standard + data.weight_large;
  const loadingType = data.loading_type;
  const distance = data.deliveryDistance || 0;
  const extraDistance = Math.max(0, distance - 40);

  let heightRestricted = false;
  let forceSmallVehicle = false;
  let trips = 1;

  // ⛔ Подземный паркинг — ограничение по высоте < 2.2 м
  if (data.underground && parseFloat(data.height_limit) < 2.2) {
    heightRestricted = true;
    forceSmallVehicle = true;
    if (totalWeight > 1500) {
      trips = 2;
    }
  }

  // Выбор транспорта
  const vehicle = selectVehicle(totalWeight, loadingType, forceSmallVehicle ? 1500 : null);

  if (!vehicle) {
    document.getElementById("result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта под эти параметры.</p>";
    return;
  }

  // 💰 Базовая стоимость
  let cost = vehicle.minTariff + extraDistance * vehicle.perKm;

  // 💰 Надбавка за загрузку
  const loadingSurcharge = getLoadingSurcharge(vehicle, loadingType);
  cost += loadingSurcharge;

  // 💰 Возврат тары
  if (data.return_pallets) {
    cost += 2500;
  }

  // 💰 Подземный паркинг
  if (data.underground) {
    cost += 1500;
  }

  // 💰 Точное время
  if (data.precise_time) {
    cost += 2500;
  }

  // 💰 Умножение на количество рейсов
  if (trips > 1) {
    cost *= trips;
  }

  // 📦 Формирование результата
  let resultHtml = `
    <h3>Расчёт стоимости доставки</h3>
    <p><strong>Транспорт:</strong> ${vehicle.name}</p>
    <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
    <p><strong>Тип загрузки:</strong> ${loadingType}</p>
    <p><strong>Расстояние:</strong> ${distance.toFixed(2)} км</p>
    <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
    <p><strong>Доп. км:</strong> ${extraDistance.toFixed(2)} км × ${vehicle.perKm} ₽ = ${(extraDistance * vehicle.perKm).toLocaleString()} ₽</p>
    ${loadingSurcharge > 0 ? `<p><strong>Надбавка за загрузку (${loadingType}):</strong> ${loadingSurcharge.toLocaleString()} ₽</p>` : ""}
    ${data.return_pallets ? `<p><strong>Возврат тары:</strong> 2 500 ₽</p>` : ""}
    ${data.underground ? `<p><strong>Подземный паркинг:</strong> 1 500 ₽</p>` : ""}
    ${data.precise_time ? `<p><strong>Доставка к точному времени:</strong> 2 500 ₽</p>` : ""}
    ${trips > 1 ? `<p><strong>Два рейса из-за ограничения по высоте и веса</strong></p>` : ""}
    <hr>
    <h3>Итого: ${Math.round(cost).toLocaleString()} ₽</h3>
  `;

  document.getElementById("result").innerHTML = resultHtml;
}
