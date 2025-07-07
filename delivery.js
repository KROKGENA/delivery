const vehicles = [
  { name: "а/м до 1т", maxWeight: 1000, loadingTypes: ["верхняя", "боковая", "любая"], surchargeTop: 1500, surchargeSide: 1500, minTariff: 4000, perKm: 100 },
  { name: "а/м до 1.5т", maxWeight: 1500, loadingTypes: ["верхняя", "боковая", "любая"], surchargeTop: 1500, surchargeSide: 1500, minTariff: 4000, perKm: 100 },
  { name: "а/м до 3т", maxWeight: 3000, loadingTypes: ["верхняя", "боковая", "любая"], surchargeTop: 1500, surchargeSide: 1500, minTariff: 4500, perKm: 115 },
  { name: "а/м 5т", maxWeight: 5000, loadingTypes: ["верхняя", "боковая", "любая"], surchargeTop: 2500, surchargeSide: 2000, minTariff: 5000, perKm: 144 },
  { name: "а/м 5т гидролифт", maxWeight: 5000, loadingTypes: ["гидролифт"], surchargeTop: 2000, surchargeSide: 2000, minTariff: 6000, perKm: 154 },
  { name: "а/м 10т", maxWeight: 10000, loadingTypes: ["верхняя", "боковая", "любая"], surchargeTop: 3000, surchargeSide: 2500, minTariff: 8000, perKm: 210 },
  { name: "Еврофура 20т", maxWeight: 20000, loadingTypes: ["верхняя", "боковая", "любая"], surchargeTop: 3500, surchargeSide: 3000, minTariff: 10000, perKm: 250 },
  { name: "Манипулятор 5т", maxWeight: 5000, loadingTypes: ["manipulator"], surchargeTop: 0, surchargeSide: 0, minTariff: 15000, perKm: 240 },
  { name: "Манипулятор 10т", maxWeight: 10000, loadingTypes: ["manipulator"], surchargeTop: 0, surchargeSide: 0, minTariff: 20000, perKm: 240 },
  { name: "Манипулятор 15т", maxWeight: 15000, loadingTypes: ["manipulator"], surchargeTop: 0, surchargeSide: 0, minTariff: 25000, perKm: 240 },
];

const formatsWithLift = ["100x200", "100x260", "100x280"];

function selectVehicle(totalWeight, loadingType) {
  return vehicles.find(v => v.maxWeight >= totalWeight && v.loadingTypes.includes(loadingType));
}

function calculateDelivery() {
  if (!window.formData) {
    alert("Сначала сохраните параметры");
    return;
  }

  const data = window.formData;
  const weight = data.weight_standard + data.weight_large;
  const loading = data.loading_type;
  const distance = data.deliveryDistance || 0;
  const extra = Math.max(0, distance - 40);
  const heightLimit = parseFloat(data.height_limit);
  const forceUseSmallVehicle = data.underground && heightLimit && heightLimit < 2.2;
  let selectedVehicle;

  if (forceUseSmallVehicle) {
    const oneTripVehicle = vehicles.find(v => v.name === "а/м до 1.5т");
    const trips = Math.ceil(weight / 1500);
    selectedVehicle = oneTripVehicle;
    selectedVehicle.trips = trips;
  } else {
    selectedVehicle = selectVehicle(weight, loading);
    selectedVehicle.trips = 1;
  }

  if (!selectedVehicle) {
    document.getElementById("result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта под эти параметры.</p>";
    return;
  }

  let cost = selectedVehicle.minTariff * selectedVehicle.trips;
  let extraCost = extra * selectedVehicle.perKm * selectedVehicle.trips;
  let surcharge = 0;

  if (loading === "верхняя") surcharge = selectedVehicle.surchargeTop;
  else if (loading === "боковая") surcharge = selectedVehicle.surchargeSide;

  let text = `
    <h3>Расчёт стоимости доставки</h3>
    <p><strong>Транспорт:</strong> ${selectedVehicle.name}${selectedVehicle.trips > 1 ? ` × ${selectedVehicle.trips} рейса` : ""}</p>
    <p><strong>Общий вес:</strong> ${weight} кг</p>
    <p><strong>Тип загрузки:</strong> ${loading}</p>
    <p><strong>Расстояние:</strong> ${distance.toFixed(2)} км</p>
    <p><strong>Базовый тариф:</strong> ${selectedVehicle.minTariff.toLocaleString()} ₽ × ${selectedVehicle.trips} = ${(selectedVehicle.minTariff * selectedVehicle.trips).toLocaleString()} ₽</p>
    <p><strong>Доп. км:</strong> ${extra.toFixed(2)} км × ${selectedVehicle.perKm} ₽ × ${selectedVehicle.trips} = ${extraCost.toLocaleString()} ₽</p>
  `;

  if (surcharge > 0) {
    cost += surcharge;
    text += `<p><strong>Надбавка за загрузку (${loading}):</strong> ${surcharge.toLocaleString()} ₽</p>`;
  }

  if (data.return_pallets) {
    cost += 2500;
    text += `<p><strong>Возврат тары:</strong> 2 500 ₽</p>`;
  }

  if (data.underground) {
    cost += 1500;
    text += `<p><strong>Подземный паркинг:</strong> 1 500 ₽</p>`;
  }

  if (data.precise_time) {
    cost += 2500;
    text += `<p><strong>Доставка к точному времени:</strong> 2 500 ₽</p>`;
  }

  // 👷 Грузчики
  if (data.need_movers) {
    let moverCost = 0;

    const floor = parseInt(data.floor) || 1;
    const hasLift = data.lift === "true";
    const format = data.large_format;
    const largeWeight = data.weight_large || 0;
    const standardWeight = data.weight_standard || 0;

    // Крупный формат
    if (largeWeight > 0) {
      if (data.only_unload === "true") {
        moverCost += largeWeight * 20;
      } else {
        if (formatsWithLift.includes(format) && hasLift) {
          moverCost += largeWeight * 30;
        } else {
          let rate = 50;
          if (floor > 5) rate = 60;
          if (floor > 10) rate = 70;
          if (floor > 20) rate = 90;
          moverCost += largeWeight * rate;
        }
      }
    }

    // Стандартная плитка
    if (standardWeight > 0) {
      if (data.only_unload === "true") {
        moverCost += standardWeight * 7;
      } else {
        if (hasLift) {
          moverCost += standardWeight * 9;
        } else {
          let rate = 15;
          if (floor > 5) rate = 20;
          if (floor > 10) rate = 30;
          if (floor > 20) rate = 50;
          moverCost += standardWeight * rate;
        }
      }
    }

    cost += moverCost;
    text += `<p><strong>Грузчики:</strong> ${Math.round(moverCost).toLocaleString()} ₽</p>`;
  }

  text += `<hr><h3>Итого: ${Math.round(cost).toLocaleString()} ₽</h3>`;
  document.getElementById("result").innerHTML = text;
}
