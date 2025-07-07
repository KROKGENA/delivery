// 🚚 Автопарк
const vehicles = [
  { name: "а/м до 1т", maxWeight: 1000, loadingTypes: ["верхняя", "боковая", "любая"], surcharge: 1000, minTariff: 4000, perKm: 100 },
  { name: "а/м до 1.5т", maxWeight: 1500, loadingTypes: ["верхняя", "боковая", "любая"], surcharge: 1500, minTariff: 4000, perKm: 100 },
  { name: "а/м до 3т", maxWeight: 3000, loadingTypes: ["верхняя", "боковая", "любая"], surcharge: 1500, minTariff: 4500, perKm: 115 },
  { name: "а/м 5т", maxWeight: 5000, loadingTypes: ["верхняя", "боковая", "любая"], surcharge: 1500, minTariff: 5000, perKm: 144 },
  { name: "а/м 5т гидролифт", maxWeight: 5000, loadingTypes: ["гидролифт"], surcharge: 2000, minTariff: 6000, perKm: 154 },
  { name: "а/м 10т", maxWeight: 10000, loadingTypes: ["верхняя", "боковая", "любая"], surcharge: 3000, minTariff: 8000, perKm: 210 },
  { name: "Еврофура 20т", maxWeight: 20000, loadingTypes: ["верхняя", "боковая", "любая"], surcharge: 3500, minTariff: 10000, perKm: 250 },
  { name: "Манипулятор 5т", maxWeight: 5000, loadingTypes: ["manipulator"], surcharge: 0, minTariff: 15000, perKm: 240 },
  { name: "Манипулятор 10т", maxWeight: 10000, loadingTypes: ["manipulator"], surcharge: 0, minTariff: 20000, perKm: 240 },
  { name: "Манипулятор 15т", maxWeight: 15000, loadingTypes: ["manipulator"], surcharge: 0, minTariff: 25000, perKm: 240 }
];

function selectVehicle(totalWeight, loadingType) {
  return vehicles.find(v => v.maxWeight >= totalWeight && v.loadingTypes.includes(loadingType));
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

  let resultHtml = `<h3>Расчёт стоимости доставки</h3>`;
  let cost = 0;
  let vehicle;

  // 💡 Подземный паркинг и высота
  if (data.underground && data.height_limit && parseFloat(data.height_limit) < 2.2) {
    let remainingWeight = totalWeight;
    let routes = [];

    while (remainingWeight > 0) {
      if (remainingWeight >= 1500) {
        routes.push("1.5");
        remainingWeight -= 1500;
      } else {
        routes.push("1.0");
        remainingWeight -= 1000;
      }
    }

    resultHtml += `<p><strong>Подземный паркинг:</strong> ${routes.length} рейсов (по ${routes.join(", ")} т)</p>`;

    routes.forEach(weightType => {
      const subVehicle = selectVehicle(weightType === "1.5" ? 1500 : 1000, loadingType);
      if (!subVehicle) return;

      cost += subVehicle.minTariff + (extraDistance * subVehicle.perKm);

      if (["верхняя", "боковая"].includes(loadingType)) {
        cost += subVehicle.surcharge;
      }
    });

    cost += 1500; // Надбавка за паркинг
    resultHtml += `<p><strong>Надбавка за подземный паркинг:</strong> 1 500 ₽</p>`;
  } else {
    // 🚚 Подбор транспорта
    vehicle = selectVehicle(totalWeight, loadingType);
    if (!vehicle) {
      document.getElementById("result").innerHTML = `<p style='color:red;'>Нет подходящего транспорта под эти параметры.</p>`;
      return;
    }

    cost += vehicle.minTariff;
    cost += extraDistance * vehicle.perKm;

    resultHtml += `
      <p><strong>Транспорт:</strong> ${vehicle.name}</p>
      <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
      <p><strong>Тип загрузки:</strong> ${loadingType}</p>
      <p><strong>Расстояние:</strong> ${distance.toFixed(2)} км</p>
      <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
      <p><strong>Доп. км:</strong> ${extraDistance.toFixed(2)} км × ${vehicle.perKm} ₽ = ${(extraDistance * vehicle.perKm).toLocaleString()} ₽</p>
    `;

    if (["верхняя", "боковая"].includes(loadingType)) {
      cost += vehicle.surcharge;
      resultHtml += `<p><strong>Надбавка за загрузку (${loadingType}):</strong> ${vehicle.surcharge.toLocaleString()} ₽</p>`;
    }
  }

  // 🎯 Точное время
  if (data.precise_time) {
    cost += 2500;
    resultHtml += `<p><strong>Доставка к точному времени:</strong> 2 500 ₽</p>`;
  }

  // ♻️ Возврат тары
  if (data.return_pallets) {
    cost += 2500;
    resultHtml += `<p><strong>Возврат тары:</strong> 2 500 ₽</p>`;
  }

  // 🧱 Грузчики
  if (data.need_movers) {
    const floor = parseInt(data.floor);
    const safeFloor = isNaN(floor) ? 1 : floor;
    const hasLift = data.lift === "true";
    const onlyUnload = data.only_unload === "true";
    const largeWeight = data.weight_large;
    const standardWeight = data.weight_standard;
    const format = data.large_format;
    const isLiftFormat = ["100x200", "100x260", "100x280"].includes(format);

    let moversCost = 0;

    // Крупная плитка
    if (largeWeight > 0) {
      if (onlyUnload) {
        moversCost += 20 * largeWeight;
      } else if (isLiftFormat && hasLift) {
        moversCost += 30 * largeWeight;
      } else {
        let rate = 50;
        if (safeFloor > 20) rate = 90;
        else if (safeFloor > 10) rate = 70;
        else if (safeFloor > 5) rate = 60;
        moversCost += rate * largeWeight;
      }
    }

    // Стандартная плитка
    if (standardWeight > 0) {
      if (onlyUnload) {
        moversCost += 7 * standardWeight;
      } else if (hasLift) {
        moversCost += 9 * standardWeight;
      } else {
        let rate = 15;
        if (safeFloor > 20) rate = 50;
        else if (safeFloor > 10) rate = 30;
        else if (safeFloor > 5) rate = 20;
        moversCost += rate * standardWeight;
      }
    }

    cost += moversCost;
    resultHtml += `<p><strong>Грузчики:</strong> ${Math.round(moversCost).toLocaleString()} ₽</p>`;
  }

  // ✅ Финал
  resultHtml += `<hr><h3>Итого: ${Math.round(cost).toLocaleString()} ₽</h3>`;
  document.getElementById("result").innerHTML = resultHtml;
}
