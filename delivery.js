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
  const isUnderground = data.underground && parseFloat(data.height_limit) < 2.2;

  let vehiclesUsed = [];
  let cost = 0;

  if (isUnderground) {
    // 🚧 Паркинг < 2.2 м — считаем по 1.5т и 1т
    let remaining = totalWeight;
    const v15 = vehicles.find(v => v.name.includes("до 1.5т") && v.loadingTypes.includes(loadingType));
    const v10 = vehicles.find(v => v.name.includes("до 1т") && v.loadingTypes.includes(loadingType));

    const count15 = Math.floor(remaining / 1500);
    remaining -= count15 * 1500;
    const count10 = remaining > 0 ? 1 : 0;

    for (let i = 0; i < count15; i++) vehiclesUsed.push(v15);
    if (count10) vehiclesUsed.push(v10);

    vehiclesUsed.forEach(vehicle => {
      let localCost = vehicle.minTariff + extraDistance * vehicle.perKm;

      const loadingSurcharge = getLoadingSurcharge(vehicle, loadingType);
      localCost += loadingSurcharge;

      if (data.return_pallets) localCost += 2500;
      if (data.precise_time) localCost += 2500;
      if (isUnderground) localCost += 1500;

      cost += localCost;
    });
  } else {
    // 🚚 Обычный случай — одна машина
    const vehicle = selectVehicle(totalWeight, loadingType);
    if (!vehicle) {
      document.getElementById("result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта под эти параметры.</p>";
      return;
    }

    vehiclesUsed.push(vehicle);

    cost = vehicle.minTariff + extraDistance * vehicle.perKm;

    const loadingSurcharge = getLoadingSurcharge(vehicle, loadingType);
    cost += loadingSurcharge;

    if (data.return_pallets) cost += 2500;
    if (data.precise_time) cost += 2500;
    if (data.underground) cost += 1500;
  }

  // === 💪 Расчёт грузчиков ===
  let moversCost = 0;

  if (data.need_movers) {
    const floor = parseInt(data.floor) || 1;
    const hasLift = data.lift === "true";
    const onlyUnload = data.only_unload === "true";

    const largeWeight = data.weight_large;
    const standardWeight = data.weight_standard;
    const format = data.large_format;
    const isLiftFormat = ["100x200", "100x260", "100x280"].includes(format);

    // === 1. Крупная плитка ===
    if (largeWeight > 0) {
      if (onlyUnload) {
        moversCost += 20 * largeWeight;
      } else if (isLiftFormat && hasLift) {
        moversCost += 30 * largeWeight;
      } else {
        let rate = 50;
        if (floor > 20) rate = 90;
        else if (floor > 10) rate = 70;
        else if (floor > 5) rate = 60;
        moversCost += rate * largeWeight;
      }
    }

    // === 2. Стандартная плитка ===
    if (standardWeight > 0) {
      if (onlyUnload) {
        moversCost += 7 * standardWeight;
      } else if (hasLift) {
        moversCost += 9 * standardWeight;
      } else {
        let rate = 15;
        if (floor > 20) rate = 50;
        else if (floor > 10) rate = 30;
        else if (floor > 5) rate = 20;
        moversCost += rate * standardWeight;
      }
    }

    cost += moversCost;
  }

  // 🖥 Вывод
  let resultHtml = `
    <h3>Расчёт стоимости доставки</h3>
    <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
    <p><strong>Тип загрузки:</strong> ${loadingType}</p>
    <p><strong>Расстояние:</strong> ${distance.toFixed(2)} км</p>
    <p><strong>Кол-во рейсов:</strong> ${vehiclesUsed.length}</p>
    <ul>${vehiclesUsed.map(v => `<li>${v.name}</li>`).join("")}</ul>
    ${data.return_pallets ? `<p>Возврат тары: 2 500 ₽ × ${vehiclesUsed.length}</p>` : ""}
    ${data.precise_time ? `<p>Доставка к точному времени: 2 500 ₽ × ${vehiclesUsed.length}</p>` : ""}
    ${data.underground ? `<p>Подземный паркинг: 1 500 ₽ × ${vehiclesUsed.length}</p>` : ""}
    ${data.need_movers ? `<p><strong>Грузчики:</strong> ${Math.round(moversCost).toLocaleString()} ₽</p>` : ""}
    <hr>
    <h3>Итого: ${Math.round(cost).toLocaleString()} ₽</h3>
  `;

  document.getElementById("result").innerHTML = resultHtml;
}
