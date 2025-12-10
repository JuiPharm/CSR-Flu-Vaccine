// TODO: ใส่ URL Web App ของคุณ (ลงท้ายด้วย /exec)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyGrzscPSTdIgmt2CZ5dCA8McvdUe4ca58gVdccD9loEMgvk25tWD0rVNmPOj2C-nNo/exec';

let currentCitizenId = null;
let dashboardLoaded = false;
let allRegistrations = []; // cache ข้อมูลลงทะเบียนทั้งหมด
let dashboardChart = null;

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const saveVaccinationBtn = document.getElementById('saveVaccinationBtn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const staffIdInput = document.getElementById('staffIdInput');
  const refreshDataBtn = document.getElementById('refreshDataBtn');

  searchBtn.addEventListener('click', onSearchClick);
  saveVaccinationBtn.addEventListener('click', onSaveVaccinationClick);

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => onTabClick(btn));
  });

  staffIdInput.addEventListener('blur', onStaffIdBlur);
  staffIdInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') onStaffIdBlur();
  });

  // ปุ่ม Refresh data
  if (refreshDataBtn) {
    refreshDataBtn.addEventListener('click', async () => {
      await loadAllRegistrations();
      if (dashboardLoaded) {
        await loadDashboard();
      }
    });
  }

  // โหลดผู้ลงทะเบียนทั้งหมดครั้งเดียวตอนเปิด
  loadAllRegistrations();

  // Auto refresh ทุก 5 นาที เบื้องหลัง
  setInterval(async () => {
    await loadAllRegistrations();
    if (dashboardLoaded) {
      await loadDashboard();
    }
  }, 5 * 60 * 1000);
});

/**
 * โหลดผู้ลงทะเบียนทั้งหมดครั้งเดียว
 */
async function loadAllRegistrations() {
  try {
    const url = `${API_BASE_URL}?action=getAllRegistrations`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.warn('ไม่สามารถโหลดข้อมูลลงทะเบียนทั้งหมด:', data.message);
      return;
    }

    allRegistrations = data.data || [];
  } catch (err) {
    console.error('loadAllRegistrations error:', err);
  }
}

/**
 * Tab switch
 */
function onTabClick(btn) {
  const targetTabId = btn.getAttribute('data-tab');

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === targetTabId);
  });

  if (targetTabId === 'dashboardTab') {
    loadDashboard();
    dashboardLoaded = true;
  }
}

/**
 * โหลด Dashboard summary + สร้างกราฟ
 */
async function loadDashboard() {
  try {
    const url = `${API_BASE_URL}?action=getDashboard`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.warn('Dashboard error:', data.message);
      return;
    }

    const d = data.data || {};

    document.getElementById('dashTotalRegistrations').textContent =
      d.totalRegistrations != null ? d.totalRegistrations : '-';
    document.getElementById('dashTotalVaccinations').textContent =
      d.totalVaccinations != null ? d.totalVaccinations : '-';
    document.getElementById('dashTotalUniqueVaccinated').textContent =
      d.totalUniqueVaccinated != null ? d.totalUniqueVaccinated : '-';
    document.getElementById('dashTotalUnvaccinated').textContent =
      d.totalUnvaccinated != null ? d.totalUnvaccinated : '-';

    const tbody = document.getElementById('dashboardSlotBody');
    tbody.innerHTML = '';

    const slots = d.slots || [];
    const labels = [];
    const regData = [];
    const vacData = [];

    slots.forEach(slotRow => {
      labels.push(slotRow.slot || '');
      regData.push(slotRow.registrations != null ? slotRow.registrations : 0);
      vacData.push(slotRow.vaccinated != null ? slotRow.vaccinated : 0);

      const tr = document.createElement('tr');

      const tdSlot = document.createElement('td');
      tdSlot.textContent = slotRow.slot || '';
      tr.appendChild(tdSlot);

      const tdReg = document.createElement('td');
      tdReg.textContent = slotRow.registrations != null ? slotRow.registrations : 0;
      tr.appendChild(tdReg);

      const tdVac = document.createElement('td');
      tdVac.textContent = slotRow.vaccinated != null ? slotRow.vaccinated : 0;
      tr.appendChild(tdVac);

      tbody.appendChild(tr);
    });

    // กราฟ bar Chart
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    if (dashboardChart) {
      dashboardChart.destroy();
    }
    dashboardChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'ลงทะเบียน',
            data: regData
          },
          {
            label: 'ฉีดแล้ว',
            data: vacData
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

/**
 * ค้นหาผู้ลงทะเบียนจาก citizenId (จาก cache allRegistrations)
 */
async function onSearchClick() {
  const citizenIdInput = document.getElementById('citizenIdInput');
  const citizenId = (citizenIdInput.value || '').trim();
  const searchMessage = document.getElementById('searchMessage');

  clearRegistrationDisplay();
  clearHistoryDisplay();
  document.getElementById('vaccinationSection').classList.add('hidden');

  if (!citizenId) {
    searchMessage.textContent = 'กรุณากรอกหมายเลขบัตรประชาชน';
    searchMessage.classList.add('error');
    return;
  }

  searchMessage.textContent = 'กำลังค้นหา...';
  searchMessage.classList.remove('error');

  const reg = allRegistrations.find(r => r.citizenId === citizenId);

  if (!reg) {
    searchMessage.textContent = 'ไม่พบข้อมูลการลงทะเบียนสำหรับหมายเลขบัตรประชาชนนี้';
    searchMessage.classList.add('error');
    currentCitizenId = null;
    return;
  }

  currentCitizenId = reg.citizenId;
  displayRegistration(reg);
  searchMessage.textContent = 'พบข้อมูลผู้ลงทะเบียน';

  document.getElementById('vaccinationSection').classList.remove('hidden');
  document.getElementById('staffIdInput').focus();

  await loadVaccinationHistory(currentCitizenId);
}

function displayRegistration(reg) {
  document.getElementById('registrationSection').classList.remove('hidden');
  document.getElementById('regFullName').textContent = reg.fullName || '';
  document.getElementById('regCitizenId').textContent = reg.citizenId || '';
  document.getElementById('regPhone').textContent = reg.phone || '';
  document.getElementById('regAppointmentSlot').textContent = reg.appointmentSlot || '';
}

function clearRegistrationDisplay() {
  document.getElementById('registrationSection').classList.add('hidden');
  document.getElementById('regFullName').textContent = '';
  document.getElementById('regCitizenId').textContent = '';
  document.getElementById('regPhone').textContent = '';
  document.getElementById('regAppointmentSlot').textContent = '';
}

/**
 * ดึงประวัติการฉีดวัคซีน
 */
async function loadVaccinationHistory(citizenId) {
  const historySection = document.getElementById('historySection');
  const historyBody = document.getElementById('historyBody');

  historyBody.innerHTML = '';
  historySection.classList.add('hidden');

  try {
    const url = `${API_BASE_URL}?action=getVaccinationHistory&citizenId=${encodeURIComponent(citizenId)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.warn('Failed to load history:', data.message);
      return;
    }

    const records = data.data || [];
    if (records.length === 0) {
      return;
    }

    records.forEach(rec => {
      const tr = document.createElement('tr');

      const tdTimestamp = document.createElement('td');
      tdTimestamp.textContent = rec.timestamp || '';
      tr.appendChild(tdTimestamp);

      const tdVaccineName = document.createElement('td');
      tdVaccineName.textContent = rec.vaccineName || '';
      tr.appendChild(tdVaccineName);

      const tdSite = document.createElement('td');
      tdSite.textContent = rec.injectionSite || '';
      tr.appendChild(tdSite);

      const tdStaffId = document.createElement('td');
      tdStaffId.textContent = rec.staffId || '';
      tr.appendChild(tdStaffId);

      const tdNotes = document.createElement('td');
      tdNotes.textContent = rec.notes || '';
      tr.appendChild(tdNotes);

      historyBody.appendChild(tr);
    });

    historySection.classList.remove('hidden');
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

function clearHistoryDisplay() {
  document.getElementById('historyBody').innerHTML = '';
  document.getElementById('historySection').classList.add('hidden');
}

/**
 * ตรวจสอบ Staff ID → Staff Name
 */
async function onStaffIdBlur() {
  const staffIdInput = document.getElementById('staffIdInput');
  const staffNameDisplay = document.getElementById('staffNameDisplay');
  const staffId = (staffIdInput.value || '').trim();

  staffNameDisplay.textContent = '';
  staffNameDisplay.classList.remove('error');

  if (!staffId) return;

  try {
    const url = `${API_BASE_URL}?action=getStaff&staffId=${encodeURIComponent(staffId)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      staffNameDisplay.textContent = 'ไม่พบ Staff ID นี้ในระบบ';
      staffNameDisplay.classList.add('error');
      return;
    }

    staffNameDisplay.textContent = `ชื่อ: ${data.data.staffName}`;
  } catch (err) {
    console.error('Error loading staff:', err);
    staffNameDisplay.textContent = 'ไม่สามารถตรวจสอบ Staff ID ได้';
    staffNameDisplay.classList.add('error');
  }
}

/**
 * บันทึกการฉีดวัคซีน
 */
async function onSaveVaccinationClick() {
  const saveMessage = document.getElementById('saveMessage');
  saveMessage.textContent = '';
  saveMessage.classList.remove('error');

  if (!currentCitizenId) {
    saveMessage.textContent = 'กรุณาค้นหาผู้ลงทะเบียนก่อน';
    saveMessage.classList.add('error');
    return;
  }

  const staffId = (document.getElementById('staffIdInput').value || '').trim();
  const injectionSite = (document.getElementById('injectionSiteInput').value || '').trim();
  const notesPreset = (document.getElementById('notesPreset').value || '').trim();
  const notesExtra = (document.getElementById('notesExtra').value || '').trim();

  if (!staffId) {
    saveMessage.textContent = 'กรุณากรอก Staff ID';
    saveMessage.classList.add('error');
    return;
  }

  saveMessage.textContent = 'กำลังบันทึก...';

  let notes = '';
  if (notesPreset) notes = notesPreset;
  if (notesExtra) {
    notes = notes ? `${notes} - ${notesExtra}` : notesExtra;
  }

  const formData = new URLSearchParams();
  formData.append('action', 'saveVaccination');
  formData.append('citizenId', currentCitizenId);
  formData.append('staffId', staffId);
  formData.append('injectionSite', injectionSite);
  formData.append('notes', notes);

  try {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!data.success) {
      saveMessage.textContent = data.message || 'บันทึกไม่สำเร็จ';
      saveMessage.classList.add('error');

      // ถ้าเป็นกรณี CitizenId ซ้ำ → popup เตือนด้วย
      if (data.message && data.message.indexOf('ไม่สามารถบันทึกซ้ำได้') !== -1) {
        alert(data.message);
      }
      return;
    }

    saveMessage.textContent = data.message || 'บันทึกเรียบร้อย';

    document.getElementById('staffIdInput').value = '';
    document.getElementById('injectionSiteInput').value = '';
    document.getElementById('notesPreset').value = '';
    document.getElementById('notesExtra').value = '';
    document.getElementById('staffNameDisplay').textContent = '';

    await loadVaccinationHistory(currentCitizenId);

    if (dashboardLoaded) {
      await loadDashboard();
    }
  } catch (err) {
    console.error(err);
    saveMessage.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
    saveMessage.classList.add('error');
  }
}
// TODO: ใส่ URL Web App ของคุณ (ลงท้ายด้วย /exec)
const API_BASE_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXX/exec';

let currentCitizenId = null;
let dashboardLoaded = false;
let allRegistrations = []; // cache ข้อมูลลงทะเบียนทั้งหมด
let dashboardChart = null;

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const saveVaccinationBtn = document.getElementById('saveVaccinationBtn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const staffIdInput = document.getElementById('staffIdInput');
  const refreshDataBtn = document.getElementById('refreshDataBtn');

  searchBtn.addEventListener('click', onSearchClick);
  saveVaccinationBtn.addEventListener('click', onSaveVaccinationClick);

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => onTabClick(btn));
  });

  staffIdInput.addEventListener('blur', onStaffIdBlur);
  staffIdInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') onStaffIdBlur();
  });

  // ปุ่ม Refresh data
  if (refreshDataBtn) {
    refreshDataBtn.addEventListener('click', async () => {
      await loadAllRegistrations();
      if (dashboardLoaded) {
        await loadDashboard();
      }
    });
  }

  // โหลดผู้ลงทะเบียนทั้งหมดครั้งเดียวตอนเปิด
  loadAllRegistrations();

  // Auto refresh ทุก 5 นาที เบื้องหลัง
  setInterval(async () => {
    await loadAllRegistrations();
    if (dashboardLoaded) {
      await loadDashboard();
    }
  }, 5 * 60 * 1000);
});

/**
 * โหลดผู้ลงทะเบียนทั้งหมดครั้งเดียว
 */
async function loadAllRegistrations() {
  try {
    const url = `${API_BASE_URL}?action=getAllRegistrations`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.warn('ไม่สามารถโหลดข้อมูลลงทะเบียนทั้งหมด:', data.message);
      return;
    }

    allRegistrations = data.data || [];
  } catch (err) {
    console.error('loadAllRegistrations error:', err);
  }
}

/**
 * Tab switch
 */
function onTabClick(btn) {
  const targetTabId = btn.getAttribute('data-tab');

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b === btn);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === targetTabId);
  });

  if (targetTabId === 'dashboardTab') {
    loadDashboard();
    dashboardLoaded = true;
  }
}

/**
 * โหลด Dashboard summary + สร้างกราฟ
 */
async function loadDashboard() {
  try {
    const url = `${API_BASE_URL}?action=getDashboard`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.warn('Dashboard error:', data.message);
      return;
    }

    const d = data.data || {};

    document.getElementById('dashTotalRegistrations').textContent =
      d.totalRegistrations != null ? d.totalRegistrations : '-';
    document.getElementById('dashTotalVaccinations').textContent =
      d.totalVaccinations != null ? d.totalVaccinations : '-';
    document.getElementById('dashTotalUniqueVaccinated').textContent =
      d.totalUniqueVaccinated != null ? d.totalUniqueVaccinated : '-';
    document.getElementById('dashTotalUnvaccinated').textContent =
      d.totalUnvaccinated != null ? d.totalUnvaccinated : '-';

    const tbody = document.getElementById('dashboardSlotBody');
    tbody.innerHTML = '';

    const slots = d.slots || [];
    const labels = [];
    const regData = [];
    const vacData = [];

    slots.forEach(slotRow => {
      labels.push(slotRow.slot || '');
      regData.push(slotRow.registrations != null ? slotRow.registrations : 0);
      vacData.push(slotRow.vaccinated != null ? slotRow.vaccinated : 0);

      const tr = document.createElement('tr');

      const tdSlot = document.createElement('td');
      tdSlot.textContent = slotRow.slot || '';
      tr.appendChild(tdSlot);

      const tdReg = document.createElement('td');
      tdReg.textContent = slotRow.registrations != null ? slotRow.registrations : 0;
      tr.appendChild(tdReg);

      const tdVac = document.createElement('td');
      tdVac.textContent = slotRow.vaccinated != null ? slotRow.vaccinated : 0;
      tr.appendChild(tdVac);

      tbody.appendChild(tr);
    });

    // กราฟ bar Chart
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    if (dashboardChart) {
      dashboardChart.destroy();
    }
    dashboardChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'ลงทะเบียน',
            data: regData
          },
          {
            label: 'ฉีดแล้ว',
            data: vacData
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top'
          }
        },
        scales: {
          x: {
            ticks: { font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

/**
 * ค้นหาผู้ลงทะเบียนจาก citizenId (จาก cache allRegistrations)
 */
async function onSearchClick() {
  const citizenIdInput = document.getElementById('citizenIdInput');
  const citizenId = (citizenIdInput.value || '').trim();
  const searchMessage = document.getElementById('searchMessage');

  clearRegistrationDisplay();
  clearHistoryDisplay();
  document.getElementById('vaccinationSection').classList.add('hidden');

  if (!citizenId) {
    searchMessage.textContent = 'กรุณากรอกหมายเลขบัตรประชาชน';
    searchMessage.classList.add('error');
    return;
  }

  searchMessage.textContent = 'กำลังค้นหา...';
  searchMessage.classList.remove('error');

  const reg = allRegistrations.find(r => r.citizenId === citizenId);

  if (!reg) {
    searchMessage.textContent = 'ไม่พบข้อมูลการลงทะเบียนสำหรับหมายเลขบัตรประชาชนนี้';
    searchMessage.classList.add('error');
    currentCitizenId = null;
    return;
  }

  currentCitizenId = reg.citizenId;
  displayRegistration(reg);
  searchMessage.textContent = 'พบข้อมูลผู้ลงทะเบียน';

  document.getElementById('vaccinationSection').classList.remove('hidden');
  document.getElementById('staffIdInput').focus();

  await loadVaccinationHistory(currentCitizenId);
}

function displayRegistration(reg) {
  document.getElementById('registrationSection').classList.remove('hidden');
  document.getElementById('regFullName').textContent = reg.fullName || '';
  document.getElementById('regCitizenId').textContent = reg.citizenId || '';
  document.getElementById('regPhone').textContent = reg.phone || '';
  document.getElementById('regAppointmentSlot').textContent = reg.appointmentSlot || '';
}

function clearRegistrationDisplay() {
  document.getElementById('registrationSection').classList.add('hidden');
  document.getElementById('regFullName').textContent = '';
  document.getElementById('regCitizenId').textContent = '';
  document.getElementById('regPhone').textContent = '';
  document.getElementById('regAppointmentSlot').textContent = '';
}

/**
 * ดึงประวัติการฉีดวัคซีน
 */
async function loadVaccinationHistory(citizenId) {
  const historySection = document.getElementById('historySection');
  const historyBody = document.getElementById('historyBody');

  historyBody.innerHTML = '';
  historySection.classList.add('hidden');

  try {
    const url = `${API_BASE_URL}?action=getVaccinationHistory&citizenId=${encodeURIComponent(citizenId)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      console.warn('Failed to load history:', data.message);
      return;
    }

    const records = data.data || [];
    if (records.length === 0) {
      return;
    }

    records.forEach(rec => {
      const tr = document.createElement('tr');

      const tdTimestamp = document.createElement('td');
      tdTimestamp.textContent = rec.timestamp || '';
      tr.appendChild(tdTimestamp);

      const tdVaccineName = document.createElement('td');
      tdVaccineName.textContent = rec.vaccineName || '';
      tr.appendChild(tdVaccineName);

      const tdSite = document.createElement('td');
      tdSite.textContent = rec.injectionSite || '';
      tr.appendChild(tdSite);

      const tdStaffId = document.createElement('td');
      tdStaffId.textContent = rec.staffId || '';
      tr.appendChild(tdStaffId);

      const tdNotes = document.createElement('td');
      tdNotes.textContent = rec.notes || '';
      tr.appendChild(tdNotes);

      historyBody.appendChild(tr);
    });

    historySection.classList.remove('hidden');
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

function clearHistoryDisplay() {
  document.getElementById('historyBody').innerHTML = '';
  document.getElementById('historySection').classList.add('hidden');
}

/**
 * ตรวจสอบ Staff ID → Staff Name
 */
async function onStaffIdBlur() {
  const staffIdInput = document.getElementById('staffIdInput');
  const staffNameDisplay = document.getElementById('staffNameDisplay');
  const staffId = (staffIdInput.value || '').trim();

  staffNameDisplay.textContent = '';
  staffNameDisplay.classList.remove('error');

  if (!staffId) return;

  try {
    const url = `${API_BASE_URL}?action=getStaff&staffId=${encodeURIComponent(staffId)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success) {
      staffNameDisplay.textContent = 'ไม่พบ Staff ID นี้ในระบบ';
      staffNameDisplay.classList.add('error');
      return;
    }

    staffNameDisplay.textContent = `ชื่อ: ${data.data.staffName}`;
  } catch (err) {
    console.error('Error loading staff:', err);
    staffNameDisplay.textContent = 'ไม่สามารถตรวจสอบ Staff ID ได้';
    staffNameDisplay.classList.add('error');
  }
}

/**
 * บันทึกการฉีดวัคซีน
 */
async function onSaveVaccinationClick() {
  const saveMessage = document.getElementById('saveMessage');
  saveMessage.textContent = '';
  saveMessage.classList.remove('error');

  if (!currentCitizenId) {
    saveMessage.textContent = 'กรุณาค้นหาผู้ลงทะเบียนก่อน';
    saveMessage.classList.add('error');
    return;
  }

  const staffId = (document.getElementById('staffIdInput').value || '').trim();
  const injectionSite = (document.getElementById('injectionSiteInput').value || '').trim();
  const notesPreset = (document.getElementById('notesPreset').value || '').trim();
  const notesExtra = (document.getElementById('notesExtra').value || '').trim();

  if (!staffId) {
    saveMessage.textContent = 'กรุณากรอก Staff ID';
    saveMessage.classList.add('error');
    return;
  }

  saveMessage.textContent = 'กำลังบันทึก...';

  let notes = '';
  if (notesPreset) notes = notesPreset;
  if (notesExtra) {
    notes = notes ? `${notes} - ${notesExtra}` : notesExtra;
  }

  const formData = new URLSearchParams();
  formData.append('action', 'saveVaccination');
  formData.append('citizenId', currentCitizenId);
  formData.append('staffId', staffId);
  formData.append('injectionSite', injectionSite);
  formData.append('notes', notes);

  try {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!data.success) {
      saveMessage.textContent = data.message || 'บันทึกไม่สำเร็จ';
      saveMessage.classList.add('error');

      // ถ้าเป็นกรณี CitizenId ซ้ำ → popup เตือนด้วย
      if (data.message && data.message.indexOf('ไม่สามารถบันทึกซ้ำได้') !== -1) {
        alert(data.message);
      }
      return;
    }

    saveMessage.textContent = data.message || 'บันทึกเรียบร้อย';

    document.getElementById('staffIdInput').value = '';
    document.getElementById('injectionSiteInput').value = '';
    document.getElementById('notesPreset').value = '';
    document.getElementById('notesExtra').value = '';
    document.getElementById('staffNameDisplay').textContent = '';

    await loadVaccinationHistory(currentCitizenId);

    if (dashboardLoaded) {
      await loadDashboard();
    }
  } catch (err) {
    console.error(err);
    saveMessage.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
    saveMessage.classList.add('error');
  }
}
