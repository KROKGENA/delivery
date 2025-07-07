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

  // крупный формат
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

  // стандартный формат
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

  // Высота
  if (data.underground && data.height_limit && parseFloat(data.height_limit) < 2.2) {
    // нужно делить на 1.5т и 1т
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
      const v = selectVehicle(w, "верхняя"); // безопасный выбор
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

  const deliveryHtml = `
    <h3>🚚 Расчёт стоимости доставки</h3>
    <p><strong>Транспорт:</strong> ${vehicleName}</p>
    <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
    <p><strong>Тип загрузки:</strong> ${data.loading_type}</p>
    <p><strong>Расстояние:</strong> ${data.deliveryDistance.toFixed(2)} км</p>
    ${baseLine}
  `;

  const moversHtml = moversCost > 0 ? `
    <h3>👷 Грузчики:</h3>
    <p>${moversCost.toLocaleString()} ₽</p>
  ` : "";

  document.getElementById("delivery_result").innerHTML = deliveryHtml;
  document.getElementById("movers_result").innerHTML = moversHtml;
  document.getElementById("total_result").innerHTML = `
    <hr><h3>Итого: ${(deliveryCost + moversCost).toLocaleString()} ₽</h3>
  `;
}
