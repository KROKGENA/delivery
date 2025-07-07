<script>
// 🚚 Список доступных автомобилей
const vehicles = [
  {
    name: "а/м до 1т",
    maxWeight: 1000,
    loadingTypes: ["верхняя", "боковая", "любая"],
    surcharge: 1000,
    minTariff: 4000,
    perKm: 100
  },
  {
    name: "а/м до 1.5т",
    maxWeight: 1500,
    loadingTypes: ["верхняя", "боковая", "любая"],
    surcharge: 1500,
    minTariff: 4000,
    perKm: 100
  },
  {
    name: "а/м до 3т",
    maxWeight: 3000,
    loadingTypes: ["верхняя", "боковая", "любая"],
    surcharge: 1500,
    minTariff: 4500,
    perKm: 115
  },
  {
    name: "а/м 5т",
    maxWeight: 5000,
    loadingTypes: ["верхняя", "боковая", "любая"],
    surcharge: 1500,
    minTariff: 5000,
    perKm: 144
  },
  {
    name: "а/м 5т гидролифт",
    maxWeight: 5000,
    loadingTypes: ["гидролифт"],
    surcharge: 2000,
    minTariff: 6000,
    perKm: 154
  },
  {
    name: "а/м 10т",
    maxWeight: 10000,
    loadingTypes: ["верхняя", "боковая", "любая"],
    surcharge: 3000,
    minTariff: 8000,
    perKm: 210
  },
  {
    name: "Еврофура 20т",
    maxWeight: 20000,
    loadingTypes: ["верхняя", "боковая", "любая"],
    surcharge: 3500,
    minTariff: 10000,
    perKm: 250
  },
  {
    name: "Манипулятор 5т",
    maxWeight: 5000,
    loadingTypes: ["manipulator"],
    surcharge: 0,
    minTariff: 15000,
    perKm: 240
  },
  {
    name: "Манипулятор 10т",
    maxWeight: 10000,
    loadingTypes: ["manipulator"],
    surcharge: 0,
    minTariff: 20000,
    perKm: 240
  },
  {
    name: "Манипулятор 15т",
    maxWeight: 15000,
    loadingTypes: ["manipulator"],
    surcharge: 0,
    minTariff: 25000,
    perKm: 240
  }
];

// 🔍 Поиск подходящего авто по весу и типу загрузки
function selectVehicle(totalWeight, loadingType) {
  return vehicles.find(v => v.maxWeight >= totalWeight && v.loadingTypes.includes(loadingType));
}

// 📦 Основная функция расчёта стоимости доставки
function calculateDelivery() {
  // Читаем данные из формы
  const weightStandard = +document.getElementById("weight_standard").value || 0;
  const weightLarge = +document.getElementById("weight_large").value || 0;
  const loadingType = document.getElementById("loading_type").value;

  const totalWeight = weightStandard + weightLarge;
  const distance = window.deliveryDistance || 0;
  const extraDistance = Math.max(distance - 40, 0);

  // Ищем транспорт
  const vehicle = selectVehicle(totalWeight, loadingType);

  if (!vehicle) {
    document.getElementById("result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта под эти параметры.</p>";
    return;
  }

  // Базовый тариф
  let cost = vehicle.minTariff;

  // Расчёт за каждый лишний км после 40
  cost += extraDistance * vehicle.perKm;

  // Добавляем надбавку, если тип погрузки верхняя/боковая
  if (["верхняя", "боковая"].includes(loadingType)) {
    cost += vehicle.surcharge;
  }

  // Вывод
  document.getElementById("result").innerHTML = `
    <h3>Расчёт стоимости доставки</h3>
    <p><strong>Выбран транспорт:</strong> ${vehicle.name}</p>
    <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
    <p><strong>Тип загрузки:</strong> ${loadingType}</p>
    <p><strong>Расстояние:</strong> ${distance.toFixed(2)} км</p>
    <p><strong>Базовый тариф:</strong> ${vehicle.minTariff.toLocaleString()} ₽</p>
    <p><strong>Доп. расстояние:</strong> ${extraDistance.toFixed(2)} км × ${vehicle.perKm} ₽ = ${(extraDistance * vehicle.perKm).toLocaleString()} ₽</p>
    ${["верхняя", "боковая"].includes(loadingType) ? `<p><strong>Надбавка за загрузку:</strong> ${vehicle.surcharge.toLocaleString()} ₽</p>` : ""}
    <hr>
    <h3>Итого: ${Math.round(cost).toLocaleString()} ₽</h3>
  `;
}
</script>
