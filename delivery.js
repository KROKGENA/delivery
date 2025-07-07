const vehicles = [
  { name: "а/м до 1т", maxWeight: 1000, loadingTypes: ["верхняя", "боковая", "любая"], baseSurcharge: 1000, minTariff: 4000, perKm: 100 },
  { name: "а/м до 1.5т", maxWeight: 1500, loadingTypes: ["верхняя", "боковая", "любая"], baseSurcharge: 1500, minTariff: 4000, perKm: 100 },
  { name: "а/м до 3т", maxWeight: 3000, loadingTypes: ["верхняя", "боковая", "любая"], baseSurcharge: 1500, minTariff: 4500, perKm: 115 },
  { name: "а/м 5т", maxWeight: 5000, loadingTypes: ["верхняя", "боковая", "любая"], baseSurcharge: 0, minTariff: 5000, perKm: 144 },
  { name: "а/м 5т гидролифт", maxWeight: 5000, loadingTypes: ["гидролифт"], baseSurcharge: 2000, minTariff: 6000, perKm: 154 },
  { name: "а/м 10т", maxWeight: 10000, loadingTypes: ["верхняя", "боковая", "любая"], baseSurcharge: 0, minTariff: 8000, perKm: 210 },
  { name: "Еврофура 20т", maxWeight: 20000, loadingTypes: ["верхняя", "боковая", "любая"], baseSurcharge: 0, minTariff: 10000, perKm: 250 },
  { name: "Манипулятор 5т", maxWeight: 5000, loadingTypes: ["manipulator"], baseSurcharge: 0, minTariff: 15000, perKm: 240 },
  { name: "Манипулятор 10т", maxWeight: 10000, loadingTypes: ["manipulator"], baseSurcharge: 0, minTariff: 20000, perKm: 240 },
  { name: "Манипулятор 15т", maxWeight: 15000, loadingTypes: ["manipulator"], baseSurcharge: 0, minTariff: 25000, perKm: 240 }
];

function selectVehicle(weight, loadingType) {
  return vehicles.find(v => v.maxWeight >= weight && v.loadingTypes.includes(loadingType));
}

function getLoadingSurcharge(vehicle, loadingType) {
  const surchargeMap = {
    "а/м до 3т": { верхняя: 1500, боковая: 1500 },
    "а/м 5т": { верхняя: 2500, боковая: 2000 },
    "а/м 10т": { верхняя: 3000, боковая: 2500 },
    "Еврофура 20т": { верхняя: 3500, боковая: 3000 }
  };
  return surchargeMap[vehicle.name]?.[loadingType] || 0;
}

function calculateMoversCost(data) {
  if (!data.need_movers) return 0;

  const floor = parseInt(data.floor);
  const safeFloor = isNaN(floor) ? 1 : floor;
  const hasLift = data.lift === "true";
  const totalStandard = data.weight_standard || 0;
  const totalLarge = data.weight_large || 0;
  const format = data.large_format || "";
  const isOnlyUnload = data.only_unload === "true";

  let cost = 0;

  // Выгрузка стандарт
  if (totalStandard) {
    if (isOnlyUnload) {
      cost += totalStandard * 7;
    } else {
      if (hasLift) cost += totalStandard * 9;
      else if (safeFloor <= 5) cost += totalStandard * 15;
      else if (safeFloor <= 10) cost += totalStandard * 20;
      else if (safeFloor <= 20) cost += totalStandard * 30;
      else cost += totalStandard * 50;
    }
  }

  // Выгрузка крупный формат
  if (totalLarge) {
    if (isOnlyUnload) {
      cost += totalLarge * 20;
    } else {
      const canUseLift = ["100x200", "100x260", "100x280"].includes(format);
      if (canUseLift && hasLift) {
        cost += totalLarge * 30;
      } else if (safeFloor <= 5) cost += totalLarge * 50;
      else if (safeFloor <= 10) cost += totalLarge * 60;
      else if (safeFloor <= 20) cost += totalLarge * 70;
      else cost += totalLarge * 90;
    }
  }

  return cost;
}

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

  let actualWeight = totalWeight;
  let actualLoading = loadingType;

  let vehicle = selectVehicle(actualWeight, loadingType);

  // Подземный паркинг с ограничением по высоте
  if (data.underground && parseFloat(data.height_limit) < 2.2) {
    const maxVehicle = vehicles.find(v => v.maxWeight === 1500);
    const trips = Math.ceil(actualWeight / 1500);
    actualWeight = Math.ceil(actualWeight / trips);
    vehicle = maxVehicle;
  }

  if (!vehicle) {
    document.getElementById("delivery_result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта.</p>";
    return;
  }

  const trips = Math.ceil(totalWeight / vehicle.maxWeight);
  let cost = vehicle.minTariff * trips + extraDistance * vehicle.perKm * trips;

  const loadingSurcharge = getLoadingSurcharge(vehicle, loadingType);
  if (["верхняя", "боковая"].includes(loadingType)) cost += loadingSurcharge;

  if (data.return_pallets) cost += 2500;
  if (data.underground) cost += 1500;
  if (data.precise_time) cost += 2500;

  const moversCost = calculateMoversCost(data);
  const totalCost = cost + moversCost;

  const deliveryHtml = `
    <h3>Расчёт стоимости доставки</h3>
    <p><strong>Транспорт:</strong> ${vehicle.name}</p>
    <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
    <p><strong>Тип загрузки:</strong> ${loadingType}</p>
    <p><strong>Расстояние:</strong> ${distance.toFixed(2)} км</p>
    <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽ × ${trips} = ${(vehicle.minTariff * trips).toLocaleString()} ₽</p>
    <p><strong>Доп. км:</strong> ${extraDistance.toFixed(2)} км × ${vehicle.perKm} ₽ × ${trips} = ${(extraDistance * vehicle.perKm * trips).toLocaleString()} ₽</p>
    ${loadingSurcharge ? `<p><strong>Надбавка за загрузку (${loadingType}):</strong> ${loadingSurcharge.toLocaleString()} ₽</p>` : ""}
    ${data.return_pallets ? `<p><strong>Возврат тары:</strong> 2 500 ₽</p>` : ""}
    ${data.underground ? `<p><strong>Подземный паркинг:</strong> 1 500 ₽</p>` : ""}
    ${data.precise_time ? `<p><strong>Доставка к точному времени:</strong> 2 500 ₽</p>` : ""}
  `;

  const moversHtml = moversCost > 0 ? `<p><strong>Грузчики:</strong> ${moversCost.toLocaleString()} ₽</p>` : "";

  document.getElementById("delivery_result").innerHTML = deliveryHtml;
  document.getElementById("movers_result").innerHTML = moversHtml;
  document.getElementById("total_result").innerHTML = `<hr><h3>Итого: ${totalCost.toLocaleString()} ₽</h3>`;
}
