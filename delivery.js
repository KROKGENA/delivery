let vehicles = [];

async function loadTariffs() {
  try {
    const basePath = location.pathname.includes("/delivery/") ? "/delivery/" : "/";
    const response = await fetch(`${basePath}data/tariffs.json?nocache=${Date.now()}`);
    const json = await response.json();
    vehicles = json.vehicles;

    vehicles = vehicles.map(v => ({
      ...v,
      maxWeight: getMaxWeightFromName(v.name),
      loadingTypes: getLoadingTypesFromName(v.name)
    }));

    console.log("✅ Загружено с GitHub");
  } catch (e) {
    console.error("❌ Не удалось загрузить тарифы:", e);
    alert("Ошибка загрузки тарифов: " + e.message);
  }
}

function getMaxWeightFromName(name) {
  const lowered = name.toLowerCase();
  if (/манипулятор 15т/.test(lowered)) return 15000;
  if (/манипулятор 10т/.test(lowered)) return 10000;
  if (/манипулятор 5т/.test(lowered)) return 5000;
  if (/еврофура/.test(lowered)) return 20000;
  if (/\b20т\b/.test(lowered)) return 20000;
  if (/\b15т\b/.test(lowered)) return 15000;
  if (/\b10т\b/.test(lowered)) return 10000;
  if (/\b5т\b/.test(lowered)) return 5000;
  if (/\b3т\b/.test(lowered)) return 3000;
  if (/\b1\.5т\b/.test(lowered)) return 1500;
  if (/\b1т\b/.test(lowered)) return 1000;
  return 0;
}

function getLoadingTypesFromName(name) {
  const lowered = name.toLowerCase();
  if (/гидролифт/.test(lowered)) return ["гидролифт"];
  if (/манипулятор/.test(lowered)) return ["manipulator"];
  return ["любая", "верхняя", "боковая"];
}

function selectVehicle(weight, loadingType) {
  const normalizedType = (loadingType || "любая").toLowerCase();
  console.log("🚚 Подбор авто: вес =", weight, "| тип загрузки =", normalizedType);

  const vehiclePriority = [
    { name: "Манипулятор 15т", min: 10001, max: 15000 },
    { name: "Манипулятор 10т", min: 5001, max: 10000 },
    { name: "Манипулятор 5т", min: 0, max: 5000 },
    { name: "а/м 5т гидролифт", min: 0, max: 5000 },
    { name: "Еврофура 20т", min: 10001, max: 20000 },
    { name: "а/м 10т", min: 5001, max: 10000 },
    { name: "а/м 5т", min: 3001, max: 5000 },
    { name: "а/м до 3т", min: 1501, max: 3000 },
    { name: "а/м до 1.5т", min: 1001, max: 1500 },
    { name: "а/м до 1т", min: 0, max: 1000 },
  ];

  for (const rule of vehiclePriority) {
    const fitsWeight = weight >= rule.min && weight <= rule.max;
    if (!fitsWeight) continue;

    const found = vehicles.find(v =>
      v.name.toLowerCase() === rule.name.toLowerCase() &&
      v.loadingTypes.includes(normalizedType)
    );

    console.log(`  🔍 Пробуем: ${rule.name} | Диапазон: ${rule.min}-${rule.max} | Найден: ${found?.name || "нет"}`);

    if (found) {
      console.log("✅ Найдено:", found.name);
      return found;
    }
  }

  console.warn("❌ Нет подходящего авто");
  return null;
}

function calculateKmCostSmooth(distance, baseRate, minRate, decay = 0.01) {
  const kmStep = 0.1;
  let cost = 0;
  for (let km = kmStep; km <= distance; km += kmStep) {
    const rate = minRate + (baseRate - minRate) * Math.exp(-decay * km);
    cost += rate * kmStep;
  }
  return Math.round(cost);
}

// ✅ Продолжение будет вставлено ниже отдельно из-за длины
// ... предыдущий код выше остаётся без изменений

function getLoadingSurcharge(vehicle, loadingType) {
  const wt = vehicle.maxWeight;
  if (loadingType === "любая") return 0;
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

  const largeFormats = {
    "100x200": { canLift: true, rate: 300, min: 7000 },
    "100x260": { canLift: true, rate: 500, min: 12000 },
    "100x280": { canLift: true, rate: 500, min: 12000 },
    "100x290": { canLift: false, rate: 500, min: 12000 },
    "100x295": { canLift: false, rate: 500, min: 12000 },
    "100x299": { canLift: false, rate: 500, min: 12000 },
    "100x300": { canLift: false, rate: 500, min: 12000 },
    "120x240": { canLift: false, rate: 500, min: 12000 },
    "120x278": { canLift: false, rate: 550, min: 12000 },
    "120x280": { canLift: false, rate: 550, min: 12000 },
    "120x300": { canLift: false, rate: 550, min: 12000 },
    "159x324": { canLift: false, rate: 700, min: 18000 },
    "160x320": { canLift: false, rate: 700, min: 18000 },
    "162x324": { canLift: false, rate: 700, min: 18000 },
    "80x324":  { canLift: false, rate: 500, min: 12000 },
  };

  if (Array.isArray(data.large_sheets)) {
    let sum = 0;
    let maxMin = 0;

    for (const item of data.large_sheets) {
      const f = largeFormats[item.format];
      const qty = parseInt(item.count) || 0;
      if (!f || qty === 0) continue;

      if (hasLift && !f.canLift) {
        console.warn(`⚠️ Формат ${item.format} не влезает в лифт`);
      }

      const liftFactor = isOnlyUnload ? 1 : floor;
      const cost = qty * f.rate * liftFactor;
      sum += cost;

      if (f.min > maxMin) maxMin = f.min;
    }

    total += sum < maxMin ? maxMin : sum;
  }



if (standard > 0) {
  const unload = standard * 2;

  if (!isOnlyUnload) {
    const baseLift = standard * 4;

    if (hasLift) {
      // Лифт есть
      const cost = unload + baseLift;
      total += cost < 2000 ? 2000 : cost;
    } else {
      // Лифта нет, подъём вручную с 2 этажа
      const extraFloors = Math.max(0, floor - 1);
      const manualLift = standard * extraFloors * 2;
      const cost = unload + baseLift + manualLift;
      total += cost < 6000 ? 6000 : cost;
    }
  } else {
    // Только выгрузка
    total += unload;
  }
}


  return total;
}

// Продолжение следует...
// ... предыдущий код выше остаётся без изменений

function getLoadingSurcharge(vehicle, loadingType) {
  const wt = vehicle.maxWeight;
  if (loadingType === "любая") return 0;
  if (wt <= 3000) return 1500;
  if (wt === 5000) return loadingType === "боковая" ? 2000 : 2500;
  if (wt === 10000) return loadingType === "боковая" ? 2500 : 3000;
  if (wt === 20000) return loadingType === "боковая" ? 3000 : 3500;
  return 0;
}



async function calculateDelivery() {
  saveFormData(); // сохраняем всё сразу, без кнопки

if (
  (formData.weight_standard + formData.weight_large) === 0
) {
  alert("⚠️ Укажите вес плитки (стандартной или крупной).");
  return;
}

if (!formData.deliveryDistance || formData.deliveryDistance === 0) {
  alert("⚠️ Укажите адрес — вручную или нажмите на карте.");
  return;
}
  if (vehicles.length === 0) {
    await loadTariffs();
  }


  const data = window.formData;
  const totalWeight = (data.weight_standard || 0) + (data.weight_large || 0);
  const loadingType = data.loading_type || "любая";

  console.log("📦 Вес общий:", totalWeight, "| Тип загрузки:", loadingType);

  let deliveryCost = 0;
  let moversCost = 0;
  let vehicleName = "";
  let details = "";

  if (data.underground && parseFloat(data.height_limit) < 2.2) {
    let left = totalWeight;
    const parts = [];

    while (left > 0) {
      if (left > 1500) {
        parts.push(1500);
        left -= 1500;
      } else {
        parts.push(left);
        left = 0;
      }
    }

    for (const weight of parts) {
      const v = selectVehicle(weight, "верхняя");
      if (!v) {
        console.warn(`Не удалось подобрать машину для ${weight} кг`);
        continue;
      }
      const kmCost = calculateKmCostSmooth(data.deliveryDistance, v.basePerKm, v.minPerKm, v.decay);
      const surcharge = getLoadingSurcharge(v, "верхняя");
      deliveryCost += v.minTariff + kmCost + surcharge;
      details += `<p>🚚 ${v.name} (${weight} кг): ${v.minTariff.toLocaleString()} ₽ + ${kmCost.toLocaleString()} ₽ + ${surcharge.toLocaleString()} ₽</p>`;
    }

    deliveryCost += 1500;
    vehicleName = "Несколько авто (ограничение по высоте)";
  } else {
    const v = selectVehicle(totalWeight, loadingType);
    if (!v) {
      document.getElementById("delivery_result").innerHTML = "<p style='color:red;'>Нет подходящего транспорта</p>";
      return;
    }

    const kmCost = calculateKmCostSmooth(data.deliveryDistance, v.basePerKm, v.minPerKm, v.decay);
    const surcharge = getLoadingSurcharge(v, loadingType);
    deliveryCost = v.minTariff + kmCost + surcharge;
    if (data.return_pallets) deliveryCost += 2500;
    if (data.precise_time) deliveryCost += 2500;
    if (data.underground) deliveryCost += 1500;

    vehicleName = v.name;
    details = `
      <p><strong>Стоимость подачи:</strong> ${v.minTariff.toLocaleString()} ₽</p>
      <p><strong>Расстояние:</strong> ${data.deliveryDistance.toFixed(2)} км ≈ ${kmCost.toLocaleString()} ₽</p>
      ${surcharge > 0 ? `<p><strong>Надбавка за загрузку (${loadingType}):</strong> ${surcharge.toLocaleString()} ₽</p>` : ""}
      ${data.underground ? `<p>Подземный паркинг: 1 500 ₽</p>` : ""}
      ${data.return_pallets ? `<p>Возврат тары: 2 500 ₽</p>` : ""}
      ${data.precise_time ? `<p>Доставка к точному времени: 2 500 ₽</p>` : ""}
    `;
  }

  moversCost = getMoversCost(data);

  const compactHtml = `
    <p><strong>🚚 Доставка:</strong> ${deliveryCost.toLocaleString()} ₽</p>
    <p><strong>👷 Грузчики:</strong> ${moversCost.toLocaleString()} ₽</p>
    <hr>
    <h3>Итого: ${(deliveryCost + moversCost).toLocaleString()} ₽</h3>
    <div id="details_block" style="display:none;">
      <h3>🚚 Расчёт стоимости доставки</h3>
      <p><strong>Транспорт:</strong> ${vehicleName}</p>
      <p><strong>Общий вес:</strong> ${totalWeight} кг</p>
      <p><strong>Тип загрузки:</strong> ${loadingType}</p>
      <p><strong>Расстояние:</strong> ${data.deliveryDistance.toFixed(2)} км</p>
      ${details}
      ${moversCost > 0 ? `<h3>👷 Грузчики:</h3><p>${moversCost.toLocaleString()} ₽</p>` : ""}
    </div>
  `;

document.getElementById("delivery_result").innerHTML = compactHtml;
document.getElementById("delivery_result").scrollIntoView({ behavior: "smooth" });

}

function toggleDetails(e) {
  e.preventDefault();
  const block = document.getElementById("details_block");
  const link = e.target;
  if (block.style.display === "block") {
    block.style.display = "none";
    link.textContent = "Показать подробности";
  } else {
    block.style.display = "block";
    link.textContent = "Скрыть подробности";
  }
}

// Продолжение следует...
// ... предыдущий код выше остаётся без изменений

// ... calculateDelivery и toggleDetails уже добавлены

function openAdminPanel() {
  if (vehicles.length === 0) {
    alert("Сначала загрузите тарифы");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:9999;padding:20px;overflow:auto;font-family:sans-serif;";
  wrapper.id = "admin_panel";

  const html = `
    <h2>⚙️ Админка тарифов</h2>
    <p>Измените параметры и нажмите \"Сохранить\"</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;max-width:900px">
      <thead>
        <tr>
          <th>Машина</th>
          <th>Мин. тариф (₽)</th>
          <th>₽/км начальный</th>
          <th>₽/км минимальный</th>
          <th>Коэфф. уменьшения</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map((v, i) => `
          <tr>
            <td>${v.name}</td>
            <td><input type="number" value="${v.minTariff}" id="minTariff_${i}" style="width:100px"></td>
            <td><input type="number" value="${v.basePerKm}" id="basePerKm_${i}" style="width:100px"></td>
            <td><input type="number" value="${v.minPerKm}" id="minPerKm_${i}" style="width:100px"></td>
            <td><input type="number" step="0.001" value="${v.decay}" id="decay_${i}" style="width:100px"></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <br>
    <button onclick="saveAdminTariffs()">💾 Сохранить</button>
    <button onclick="loadFromGit()">🔄 Загрузить с Git</button>
    <button onclick="closeAdminPanel()">❌ Закрыть</button>
  `;

  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

function closeAdminPanel() {
  const panel = document.getElementById("admin_panel");
  if (panel) panel.remove();
}

function saveAdminTariffs() {
  vehicles.forEach((v, i) => {
    v.minTariff = parseInt(document.getElementById(`minTariff_${i}`).value);
    v.basePerKm = parseFloat(document.getElementById(`basePerKm_${i}`).value);
    v.minPerKm = parseFloat(document.getElementById(`minPerKm_${i}`).value);
    v.decay = parseFloat(document.getElementById(`decay_${i}`).value);
  });

}

async function loadFromGit() {
  await loadTariffs(true);
  alert("Тарифы загружены с Git. Локальные замены сброшены.");
  closeAdminPanel();
}

// Конец полного delivery.js
