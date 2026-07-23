window.batchResolve = null;
lucide.createIcons();
function toggleSidebar(){
  document.getElementById("sidebar").classList.toggle("collapsed");
}
let overviewPeriod = "MONTH";
let chartReady = false;
let chart;   // store chart instance
// Load charts only once
google.charts.load('current', { packages: ['corechart'] });
google.charts.setOnLoadCallback(function() {
  chartReady = true;
});
 
function animateCount(el, target) {
  let start = 0;
  let duration = 600;
  let startTime = null;
  function animate(time) {
    if (!startTime) startTime = time;
    let progress = time - startTime;
    let percent = Math.min(progress / duration, 1);
    el.innerText = Math.floor(percent * target);
    if (percent < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}
function showSection(sectionId){
document.querySelectorAll(".section")
.forEach(section => {
section.style.display = "none";
});
const activeSection =
document.getElementById(sectionId);
if(activeSection){
activeSection.style.display = "block";
}
}
// Load Tasks
let membersData = [];
let selectedSpreadsheetId;
let fullData = [];
let statusColumnIndex = -1;
let dueDateColumnIndex = -1;
function loadTasksSection(){
  showSection("tasks");
  getMembers().then(function(data){
    membersData = data;
    let dropdown = document.getElementById("memberDropdown");
    dropdown.innerHTML = "<option value=''>Select Member</option>";
    data.forEach(m=>{
      let opt = document.createElement("option");
      opt.value = m.id;
      opt.text = m.name;
      dropdown.appendChild(opt);
    });
  });
}
function loadMonths(){
  selectedSpreadsheetId =
    document.getElementById("memberDropdown").value;
  if(!selectedSpreadsheetId) return;
  showLoader();   // 🔥 START LOADER
  getMemberDashboardData(selectedSpreadsheetId).then(function(response){
    let dropdown = document.getElementById("monthDropdown");
    dropdown.innerHTML = "";
    response.months.forEach(m=>{
      let opt = document.createElement("option");
      opt.value = m;
      opt.text = m;
      dropdown.appendChild(opt);
    });
    window.cachedMonthData = response.data;
    hideLoader();  // 🔥 STOP LOADER
    loadTasks();
  });
}
function loadTasks(){
  let month = document.getElementById("monthDropdown").value;
  if(!month) return;
  let data = window.cachedMonthData[month];
  if(!data) return;
  // Get indexes before filtering
  statusColumnIndex = data[0].indexOf("Status");
  dueDateColumnIndex = data[0].indexOf("Due Date");
  let taskColumnIndex = data[0].indexOf("Task");
  let filteredData = [data[0]];
  // Remove empty task rows
  data.slice(1).forEach(row => {
    let taskValue = row[taskColumnIndex];
    if(taskValue && taskValue.toString().trim() !== ""){
      filteredData.push(row);
    }
  });
  // ===== REMOVE UNWANTED COLUMNS HERE =====
  const headers = filteredData[0];
  const removeColumns = ["Helper", "Status Date"];
  const indexesToRemove = headers
    .map((h, i) => removeColumns.includes(h) ? i : -1)
    .filter(i => i !== -1);
  const cleanedData = filteredData.map(row =>
    row.filter((cell, index) => !indexesToRemove.includes(index))
  );
  fullData = cleanedData;
  populateTable("taskTable", cleanedData);
  updateSummary(cleanedData);
  const chart = document.getElementById("performanceChart");
  chart.classList.add("fade-chart");
  setTimeout(()=>{
    chart.classList.remove("fade-chart");
  }, 50);
  updateChart(cleanedData);
  // Fade effect
  const taskSection = document.getElementById("tasks");
  taskSection.classList.add("fade-in");
  setTimeout(()=>{
    taskSection.classList.remove("fade-in");
  }, 400);
}
function populateTable(tableId, data){
  let table = document.getElementById(tableId);
  table.innerHTML = "";
  let today = new Date();
  today.setHours(0,0,0,0);
  data.forEach((row,i)=>{
    let tr = table.insertRow();
    // ===== Overdue Highlight Logic (Only for Task Table) =====
    if(i !== 0 && typeof statusColumnIndex !== "undefined" && statusColumnIndex !== -1){
      let status = row[statusColumnIndex];
      let dueDateValue = row[dueDateColumnIndex];
      if(status !== "Completed" && dueDateValue){
        let dueDate;
        if(dueDateValue instanceof Date){
          dueDate = new Date(dueDateValue);
        } else {
          let value = dueDateValue.toString().trim();
          if(value.includes("/")){
            let parts = value.split("/");
            if(parts.length === 3){
              let day = parseInt(parts[0],10);
              let month = parseInt(parts[1],10) - 1;
              let year = parseInt(parts[2],10);
              dueDate = new Date(year, month, day);
            }
          }
        }
        if(dueDate && !isNaN(dueDate.getTime())){
          dueDate.setHours(0,0,0,0);
          if(dueDate < today){
            tr.classList.add("overdue-row");
          }
        }
      }
    }
    // ===== Render Cells =====
    row.forEach(cell=>{
      let td = document.createElement(i==0 ? "th" : "td");
      let value = cell;
      // Convert to string safely
      if(value !== null && value !== undefined){
        let stringValue = value.toString();
        // Remove commas before numeric check
        let cleanValue = stringValue.replace(/,/g, "");
        // Check if numeric and not header
        if(i !== 0 && !isNaN(cleanValue) && cleanValue !== ""){
          // If value already has %, keep it
          if(stringValue.includes("%")){
            td.innerHTML = stringValue;
          } else {
            td.innerHTML = Number(cleanValue).toLocaleString('en-IN');
          }
        } else {
          td.innerHTML = stringValue;
        }
      } else {
        td.innerHTML = "";
      }
      tr.appendChild(td);
    });
  });
}
function updateSummary(data){
  if(!data || data.length <= 1){
    document.getElementById("summaryCards").innerHTML = "";
    return;
  }
  let total = data.length - 1;
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let totalDelayDays = 0;
  let today = new Date();
  today.setHours(0,0,0,0);
  data.slice(1).forEach(row => {
    let status = row[statusColumnIndex];
    let dueDateValue = row[dueDateColumnIndex];
    if(status === "Completed"){
      completed++;
    } else {
      pending++;
    }
    // ✅ Proper Overdue Logic (DD/MM/YYYY Safe)
    if (dueDateValue && status !== "Completed") {
      let dueDate;
      if (dueDateValue instanceof Date) {
        dueDate = new Date(dueDateValue);
      } else {
        let value = dueDateValue.toString().trim();
        if (value.includes("/")) {
          let parts = value.split("/");
          if (parts.length === 3) {
            let day = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1;
            let year = parseInt(parts[2], 10);
            dueDate = new Date(year, month, day);
          }
        }
      }
      if (dueDate && !isNaN(dueDate.getTime())) {
        dueDate.setHours(0,0,0,0);
        if (dueDate < today) {
          overdue++;
          // 📊 Delay Days Calculation
          let diffTime = today - dueDate;
          let delayDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          totalDelayDays += delayDays;
        }
      }
    }
  });
  let completionPercent = total > 0 
      ? Math.round((completed/total)*100) 
      : 0;
  let overduePercent = total > 0
      ? Math.round((overdue/total)*100)
      : 0;
  // 🔴 Blink if overdue > 0
  let overdueClass = overdue > 0 
      ? "card overdue overdue-alert"
      : "card overdue";
  document.getElementById("summaryCards").innerHTML = `
    <div class="card total">
      <div>Total Tasks</div>
      <h2>${total}</h2>
    </div>
    <div class="card completed">
      <div>Completed</div>
      <h2>${completed}</h2>
    </div>
    <div class="card pending">
      <div>Pending</div>
      <h2>${pending}</h2>
    </div>
    <div class="${overdueClass}">
      <div>Overdue</div>
      <h2>${overdue}</h2>
    </div>
    <div class="card">
      <div>Overdue %</div>
      <h2>${overduePercent}%</h2>
    </div>
    <div class="card percentage">
      <div>Completion %</div>
      <h2>${completionPercent}%</h2>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${completionPercent}%"></div>
      </div>
    </div>
    <div class="card">
      <div>Total Delay Days</div>
      <h2>${totalDelayDays}</h2>
    </div>
  `;
setTimeout(()=>{
  document.querySelectorAll(".card h2").forEach(el=>{
    let value = parseInt(el.innerText);
    if(!isNaN(value)){
      animateCount(el, value);
    }
  });
}, 100);
}
function filterStatus(){
  let selected = document.getElementById("statusFilter").value;
  if(selected === "All"){
    populateTable("taskTable", fullData);
    updateSummary(fullData);
    updateChart(fullData);
    return;
  }
  let filtered = [fullData[0]];
  fullData.slice(1).forEach(row=>{
    if(row[statusColumnIndex] === selected){
      filtered.push(row);
    }
  });
  populateTable("taskTable", filtered);
  updateSummary(filtered);
  updateChart(filtered);
}
function updateChart(data){
  if (!chartReady || !data || data.length <= 1) return;
  let counts = {};
  data.slice(1).forEach(row=>{
    let status = row[statusColumnIndex];
    if(status){
      counts[status] = (counts[status] || 0) + 1;
    }
  });
  let chartData = [['Status', 'Count']];
  for (let key in counts) {
    chartData.push([key, counts[key]]);
  }
  let dataTable = google.visualization.arrayToDataTable(chartData);
  let options = {
  title: 'Task Status Distribution',
  pieHole: 0.5,
  legend: { position: 'bottom' },
  chartArea: { width: '90%', height: '80%' },
  animation: {
    startup: true,
    duration: 600,
    easing: 'out'
  }
  };
  // Create chart only once
  if (!chart) {
    chart = new google.visualization.PieChart(
      document.getElementById('performanceChart')
    );
  }
  chart.draw(dataTable, options);
}
// Load Sales
function toggleSalesMenu() {
  const sidebar = document.getElementById("sidebar");
  const subMenu = document.getElementById("salesSubMenu");
  if (!sidebar.matches(":hover") && sidebar.offsetWidth < 200) {
    return; // prevent submenu in collapsed mode
  }
  subMenu.classList.toggle("show");
}
function toggleReportMenu(){
  const sidebar =
  document.getElementById("sidebar");
  const subMenu =
  document.getElementById("reportSubMenu");
  if(
    !sidebar.matches(":hover") &&
    sidebar.offsetWidth < 200
  ){
    return;
  }
  subMenu.classList.toggle("show");
}
function showDownloadReports(){
  showSection("reportCenter");
  loadReportMonths();
}
function showEmailReports(){
  showSection("reportCenter");
  loadReportMonths();
}
function loadReportMonths(){
  getOverviewMonths()
  .then(function(months){
    let dropdown =
      document.getElementById("reportMonth");
    dropdown.innerHTML = "";
    months.forEach(m => {
      let opt =
      document.createElement("option");
      opt.value = m;
      opt.text = m;
      dropdown.appendChild(opt);
    });
  });
}
function downloadBranchReports(){
  const report =
  document.getElementById("reportType").value;
  const month =
  document.getElementById("reportMonth").value;
  if(!report || !month){
    alert("Please select Report Type and Month");
    return;
  }
  generateAllBranchPDF();
}
function emailBranchReports(){
  const report =
  document.getElementById("reportType").value;
  const month =
  document.getElementById("reportMonth").value;
  alert(
    "Email Reports\n\n" +
    report +
    "\n" +
    month
  );
}
let currentSalesType = "";
let batchMode = false;
function openSalesReport(type){
  console.log("Opening report:", type);
  currentSalesType = type;
  resetSalesUI();
  showSection("sales");
  // Hide month dropdown for SONIC
  if(type === "SONIC"){
    document.getElementById("salesMonth").style.display = "none";
  } else {
    document.getElementById("salesMonth").style.display = "inline-block";
  }
  loadSalesBranches(type);
}
// (removed: dead duplicate client-side getSalesBranches that referenced
// SpreadsheetApp — a server-only API that could never run in a browser.
// The real implementation now lives in dataLayer.js.)
function loadSalesBranches(type){
  document.getElementById("salesTitle").innerText =
    type === "TOP6" ? "Top 6 Brand Sales Report" :
    type === "NF" ? "NF Sales Report" :
    "SonicWall Sales Report";
  getSalesBranches(type).then(function(branches){
    console.log("Branches received:", branches);
    let dropdown = document.getElementById("branchSelect");
    dropdown.innerHTML = "<option value=''>Select Branch</option>";
    branches.forEach(b=>{
      let opt = document.createElement("option");
      opt.value = b;
      opt.text = b;
      dropdown.appendChild(opt);
    });
  });
}
function loadSalesMonths(){
  resetSalesUI();
  let branch = document.getElementById("branchSelect").value;
  if(!branch) return;
  // 🔥 If SONIC → directly load report
  if(currentSalesType === "SONIC"){
    loadSalesReport();
    return;
  }
  // 🔹 Normal logic for TOP6 & NF
  let monthDropdown = document.getElementById("salesMonth");
  showLoader();
  getSalesMonths(currentSalesType, branch)
    .then(function(months){
      monthDropdown.innerHTML = "<option value=''>Select Month</option>";
      months.forEach(m=>{
        let opt = document.createElement("option");
        opt.value = m;
        opt.text = m;
        monthDropdown.appendChild(opt);
      });
      monthDropdown.disabled = false;
      hideLoader();
    })
    .catch(function(err){
      console.error(err);
      monthDropdown.disabled = true;
      hideLoader();
    });
}
function loadSalesReport(){
  let branch = document.getElementById("branchSelect").value;
  let month = document.getElementById("salesMonth").value;
  if(!branch){
    if(!batchMode) alert("Branch is empty");
    return;
  }
  showLoader();
  if(currentSalesType === "SONIC"){
    getSonicwallDashboardData(currentSalesType, branch, month)
      .then(function(data){
        hideLoader();
        if(!data){
          if(!batchMode) alert("No Sonic data found");
          return;
        }
        renderSonicwallDashboard(data);
      })
      .catch(function(err){
        console.error(err);
        hideLoader();
      });
  }
  else {
    if(!month){
      if(!batchMode) alert("Month is empty");
      hideLoader();
      return;
    }
    getSalesReportData(currentSalesType, branch, month)
    .then(function(data){
    if(!data || data.length === 0){
    if(window.batchResolve){
        const fn = window.batchResolve;
        window.batchResolve = null;
        fn();
    }
    if(!batchMode){
        alert("No data found");
    }
    return;
    }
      if(currentSalesType === "NF"){
        getNFGrowth(currentSalesType, branch, month)
        .then(function(growth){
          window.nfGrowth = growth;
          drawSalesCharts(data);
          hideLoader();
        })
        .catch(function(err){
          console.error(err);
          window.nfGrowth = 0;
          drawSalesCharts(data);
        });
      }
      else if(currentSalesType !== "TOP6"){
        populateTable("salesTable", data);
        drawSalesCharts(data);
      }
      else{
        getTop6Growth(currentSalesType, branch, month)
        .then(function(growth){
          window.top6Growth = growth;
          drawSalesCharts(data);
          hideLoader();
        })
        .catch(function(err){
          console.error(err);
          window.top6Growth = 0;
          drawSalesCharts(data);
        });
      }
    })
    .catch(function(err){
      console.error(err);
      hideLoader();
    });
  }
}
function drawSalesCharts(data){  
if(
   currentSalesType === "TOP6" ||
   currentSalesType === "NF"
){
  document.querySelector(".table-container").style.display = "none";
}
else{
  document.querySelector(".table-container").style.display = "block";
}
  // 🔥 Ensure normal sales charts are visible
document.getElementById("salesChartsWrapper").style.display = "grid";
// 🔥 Hide Sonic dashboard
document.getElementById("sonicDashboard").style.display = "none";
  document.getElementById('salesTrendChart').innerHTML = "";
document.getElementById('salesPieChart').innerHTML = "";
  if(!data || data.length <= 1) return;
if(!chartReady){
  google.charts.setOnLoadCallback(function(){
    drawSalesCharts(data);
  });
  return;
}
let brandCol = 1;
let lakhsCol = 3;
let percentCol = 4;
let rows = data.filter(row => {
  let brand =
    String(row[1]).trim().toUpperCase();
  if(
    brand === "PARTICULARS" ||
    brand === "PARTICULAR" ||
    brand === "BRAND" ||
    brand === "TOTAL" ||
    brand === ""
  ){
    return false;
  }
  return true;
});
if(currentSalesType === "TOP6"){
  renderTop6Summary(rows);
  renderTop6KPIs(
    rows,
    window.top6Growth || 0
  );
}
if(currentSalesType === "NF"){
  renderTop6Summary(rows);
  renderTop6KPIs(
    rows,
    window.nfGrowth || 0
  );
}
  // =========================
  // COLUMN CHART WITH LABELS
  // =========================
  let trendData = new google.visualization.DataTable();
  trendData.addColumn('string', 'Brand');
  trendData.addColumn('number', 'Lakhs');
  trendData.addColumn({ type: 'string', role: 'annotation' }); // 🔥 Label column
  rows.forEach(row => {
    let brand = row[brandCol];
    let lakhs = parseFloat(row[lakhsCol]);  
    trendData.addRow([
      brand,
      lakhs,
      lakhs.toFixed(2)  // 🔥 show label on top
    ]);
  });
  let trendOptions = {
    title: currentSalesType === "NF"
  ? "NF Sales (Lakhs)"
  : currentSalesType === "SONIC"
  ? "SonicWall Sales (Lakhs)"
  : "Top 6 Brand Sales (Lakhs)",
    legend: { position: 'none' },
    height: 450,
    width:'100%',
     chartArea:{
    left:60,
    top:50,
    width:'85%',
    height:'75%'
  },
      colors: currentSalesType === "NF"
  ? ['#ef633a']        // Red theme for NF
  : currentSalesType === "SONIC"
  ? ['#8E24AA']        // Purple theme for SonicWall
  : ['#1E88E5'],       // Blue theme for Top 6
    annotations: {
      alwaysOutside: true,
      textStyle: {
        fontSize: 12,
        bold: true
      }
    },
    animation: {
      startup: true,
      duration: 800,
      easing: 'out'
    }
  };
  window.salesTrendChartObj =
  new google.visualization.ColumnChart(
  document.getElementById('salesTrendChart')
  );
  let trendChart = window.salesTrendChartObj;
  trendChart.draw(trendData, trendOptions);
  google.visualization.events.addListener(
  trendChart,
  'select',
  function(){
    let selection = trendChart.getSelection();
    if(selection.length){
      let row = selection[0].row;
      let brand = trendData.getValue(row,0);
      showBrandDrilldown(brand);
    }
  }
);
if(currentSalesType === "TOP6"){
google.visualization.events.addListener(
trendChart,
'select',
function(){
let selection = trendChart.getSelection();
if(selection.length){
let row = selection[0].row;
let brand = trendData.getValue(row,0);
showBrandDrilldown(brand);
}
});
}
  // =========================
  // PIE CHART WITH BRAND + %
  // =========================
  let pieData = [['Brand', 'Percentage']];
  rows.forEach(row => {
    let brand = row[brandCol];
    let percent = parseFloat(String(row[percentCol]).replace('%','').trim());
    pieData.push([brand + " (" + percent + "%)", percent]);
  });
  let pieTable = google.visualization.arrayToDataTable(pieData);
  let pieOptions = {
    title: currentSalesType === "NF"
  ? "NF Share (%)"
  : currentSalesType === "SONIC"
  ? "SonicWall Share (%)"
  : "Top 6 Brand Share (%)",
    pieHole: 0.5,
    height: 450,
    width:'100%',
    chartArea:{ left:20,top:40,width:'90%',height:'80%' },
    legend: { position: 'right' },
    colors: currentSalesType === "NF"
    ? ['#ef633a', '#f07a55', '#f59575', '#f9b5a3', '#d94f22']
    : currentSalesType === "SONIC"
    ? ['#8E24AA','#BA68C8','#E1BEE7','#4A148C']
    : null,
    pieSliceText: 'percentage',  // show % inside
    animation: {
      startup: true,
      duration: 800,
      easing: 'out'
    }
  };
  window.salesPieChartObj =
  new google.visualization.PieChart(
  document.getElementById('salesPieChart')
  );
  let pieChart = window.salesPieChartObj;
  pieChart.draw(pieTable, pieOptions);
  if(rows.length > 0){
  let topBrand = rows[0][brandCol];
  showBrandDrilldown(topBrand);
}
}
//SONICWALL REPORT
function renderSonicwallDashboard(data){
  document.getElementById("salesTable").style.display = "none";
  // Hide normal sales charts
  document.getElementById("salesChartsWrapper").style.display = "none";
  let container = document.getElementById("sonicDashboard");
  container.style.display = "block";
  document.getElementById("sonicKPISection").innerHTML = `
<!-- ================= YEAR ROW ================= -->
<div class="kpi-row">
  <div class="card">
    <h3>Year Target</h3>
    <h2>${Number(data.year.target).toFixed(2)}</h2>
  </div>
  <div class="card">
    <h3>Year Achieved</h3>
    <h2>${Number(data.year.achieved).toFixed(2)}</h2>
  </div>
  <div class="card highlight">
    <h3>Achievement %</h3>
    <h2>${Number(data.year.percent).toFixed(2)}%</h2>
  </div>
</div>
<!-- ================= QUARTER ROW ================= -->
<div class="kpi-row">
  <div class="card">
    <h3>Q1 Achieved</h3>
    <h2>${Number(data.quarterly.Q1.achieved).toFixed(2)}</h2>
    <small>${Number(data.quarterly.Q1.percent).toFixed(2)}%</small>
  </div>
  <div class="card">
    <h3>Q2 Achieved</h3>
    <h2>${Number(data.quarterly.Q2.achieved).toFixed(2)}</h2>
    <small>${Number(data.quarterly.Q2.percent).toFixed(2)}%</small>
  </div>
  <div class="card">
    <h3>Q3 Achieved</h3>
    <h2>${Number(data.quarterly.Q3.achieved).toFixed(2)}</h2>
    <small>${Number(data.quarterly.Q3.percent).toFixed(2)}%</small>
  </div>
  <div class="card">
    <h3>Q4 Achieved</h3>
    <h2>${Number(data.quarterly.Q4.achieved).toFixed(2)}</h2>
    <small>${Number(data.quarterly.Q4.percent).toFixed(2)}%</small>
  </div>
</div>
`;
  if(chartReady){
    
    drawSonicMonthlyChart(data.monthly);
    drawSonicQuarterlyChart(data.quarterly);
    drawSonicModelChart(data.models);
  } else {
    google.charts.setOnLoadCallback(function(){
      drawSonicMonthlyChart(data.monthly);
      drawSonicModelChart(data.models);
    });
  }
}
function drawSonicMonthlyChart(monthly){
  if(!chartReady) return;
  let dataTable = new google.visualization.DataTable();
  dataTable.addColumn('string','Month');
  dataTable.addColumn('number','Target');
  dataTable.addColumn('number','Achieved');
  for(let i=0;i<monthly.months.length;i++){
    dataTable.addRow([
      monthly.months[i],
      Number(monthly.target[i]),
      Number(monthly.achieved[i])
    ]);
  }
  let options = {
    title: 'Monthly Target vs Achieved',
    height: 450,
    chartArea:{width:'75%',height:'70%'},
    colors:['#8E24AA','#4A148C'],
    animation:{startup:true,duration:800}
  };
  let chart = new google.visualization.ColumnChart(
    document.getElementById("sonicTrendChart")
  );
  chart.draw(dataTable, options);
}
function drawSonicModelChart(models){
  if(!chartReady) return;
  let chartData = [['Model','Value']];
  models.forEach(m=>{
    chartData.push([m.name, Number(m.value)]);
  });
  let dataTable = google.visualization.arrayToDataTable(chartData);
  let options = {
    title:'Model Contribution',
    pieHole:0.5,
    height:450,
    chartArea:{width:'80%',height:'75%'},
    animation:{startup:true,duration:800}
  };
  let chart = new google.visualization.PieChart(
    document.getElementById("sonicModelChart")
  );
  chart.draw(dataTable, options);
}
function drawSonicQuarterlyChart(quarterly){
  if(!chartReady) return;
  let dataTable = new google.visualization.DataTable();
  dataTable.addColumn('string','Quarter');
  dataTable.addColumn('number','Target');
  dataTable.addColumn('number','Achieved');
  dataTable.addRow(['Q1',
    Number(quarterly.Q1.target),
    Number(quarterly.Q1.achieved)
  ]);
  dataTable.addRow(['Q2',
    Number(quarterly.Q2.target),
    Number(quarterly.Q2.achieved)
  ]);
  dataTable.addRow(['Q3',
    Number(quarterly.Q3.target),
    Number(quarterly.Q3.achieved)
  ]);
  dataTable.addRow(['Q4',
    Number(quarterly.Q4.target),
    Number(quarterly.Q4.achieved)
  ]);
  let options = {
    title: 'Quarterly Target vs Achieved',
    height: 450,
    chartArea:{width:'75%',height:'70%'},
    colors:['#BA68C8','#4A148C'],
    animation:{startup:true,duration:800}
  };
  let chart = new google.visualization.ColumnChart(
    document.getElementById("sonicQuarterSection")
  );
  chart.draw(dataTable, options);
}
// Load Purchase
function loadPurchase() {
  showSection("purchase");
  getPurchaseData().then(data=>{
    populateTable("purchaseTable", data);
  });
}
function verifyLogin() {
let password =
document.getElementById("passwordInput").value;
checkPassword(password)
.then(function(isValid){
if(isValid){
const loginScreen =
document.getElementById("loginScreen");
loginScreen.style.opacity = "0";
loginScreen.style.pointerEvents = "none";
setTimeout(() => {
loginScreen.remove();
},500);
document.getElementById("dashboardContent").style.display = "flex";
/* ENABLE PAGE SCROLL AGAIN */
document.body.style.overflow = "auto";
/* SHOW DASHBOARD */
document.getElementById("dashboard")
.style.display = "block";
/* LOAD DATA */
loadDashboardFilters();
/* OPEN DASHBOARD */
showSection("dashboard");
}
else{
document.getElementById("loginError")
.innerText = "Incorrect Password";
}
});
}
function refreshCurrentSection(){
  if(document.getElementById("tasks").style.display === "flex"){
    loadTasks();
  }
  if(document.getElementById("purchase").style.display === "block"){
    loadPurchase();
  }
  // ❌ REMOVE sales refresh
}
function resetSalesUI(){
  // 🔥 Clear charts
  document.getElementById("salesTrendChart").innerHTML = "";
  document.getElementById("salesPieChart").innerHTML = "";
  document.getElementById("sonicTrendChart").innerHTML = "";
  document.getElementById("sonicModelChart").innerHTML = "";
  document.getElementById("sonicQuarterSection").innerHTML = "";
  // 🔥 Clear tables
  const salesTable = document.getElementById("salesTable");
  if(salesTable){
    salesTable.innerHTML = "";
  }
  // 🔥 Clear KPI section
  const sonicKPI = document.getElementById("sonicKPISection");
  if(sonicKPI){
    sonicKPI.innerHTML = "";
  }
  // 🔥 Hide both dashboards temporarily
  document.getElementById("salesChartsWrapper").style.display = "none";
  document.getElementById("sonicDashboard").style.display = "none";
  // 🔥 Clear Summary Matrix
document.getElementById("brandSummaryMatrix").innerHTML = "";
// 🔥 Clear KPI Cards
document.getElementById("top6KPIs").innerHTML = "";
// 🔥 Hide Drilldown
document.getElementById("brandDrilldown").style.display = "none";
// 🔥 Clear Drilldown Charts
document.getElementById("monthlyTrendChart").innerHTML = "";
document.getElementById("branchContributionChart").innerHTML = "";
// 🔥 Clear Drilldown Header
document.getElementById("selectedBrandTitle").innerHTML = "";
// 🔥 Clear Drilldown KPI Values
document.getElementById("drillSales").innerHTML = "";
document.getElementById("drillPercent").innerHTML = "";
document.getElementById("drillGrowthMonth").innerHTML = "";
document.getElementById("drillGrowthQuarter").innerHTML = "";
}
// Auto refresh every 60 seconds
setInterval(function(){
  refreshCurrentSection();
}, 60000);
function showLoader() {
  document.getElementById("loaderOverlay").style.display = "flex";
}
function hideLoader() {
  document.getElementById("loaderOverlay").style.display = "none";
}
let dashboardLoading = false;
function loadOverviewDashboard(){
if(dashboardLoading) return;   // prevent duplicate calls
dashboardLoading = true;
const branch = document.getElementById("overviewBranch").value;
const monthDropdown = document.getElementById("monthFilter");
const quarterDropdown = document.getElementById("quarterFilter");
const month = monthDropdown.disabled ? "" : monthDropdown.value;
const quarter = quarterDropdown.disabled ? "" : quarterDropdown.value;
getOverviewDashboardData(branch, overviewPeriod, month, quarter)
.then(function(data){
document.getElementById("top6Value").innerText =
Number(data.top6).toLocaleString('en-IN');
document.getElementById("netfoxValue").innerText =
Number(data.netfox).toLocaleString('en-IN');
document.getElementById("sonicValue").innerText =
Number(data.sonic).toLocaleString('en-IN');
drawOverviewCharts(data);
dashboardLoading = false;   // unlock
})
.catch(function(){
dashboardLoading = false;
});
}
function drawOverviewCharts(data){
if(!chartReady){
  google.charts.setOnLoadCallback(function(){
    drawOverviewCharts(data);
  });
  return;
}
let total = Number(data.top6) + Number(data.netfox) + Number(data.sonic);
let pieData = google.visualization.arrayToDataTable([
['Sales Type','Lakhs'],
['Top6 Brands', Number(data.top6)],
['Netfox', Number(data.netfox)],
['SonicWall', Number(data.sonic)]
]);
// PIE CHART
let pieChart = new google.visualization.PieChart(
document.getElementById("overviewPieChart")
);
pieChart.draw(pieData,{
title:'Sales Distribution',
backgroundColor:'transparent',
pieHole:0.6,
height:300,
/*legend:{
  position:'top',
  alignment:'center',
  textStyle:{
    color:'#1e293b',   // force visible
    fontSize:14,
    bold:true
  }
},*/
 legend: 'none',
pieSliceText: 'none',
chartArea:{
  left:10,
  top:20,
  width:'85%',
  height:'85%'
},
colors:['#3366cc','#dc3912','#ff9900'],
tooltip:{
  text:'both'
},
animation:{
  startup:true,
  duration:700,
  easing:'out'
}
});
// BAR CHART
let barData = new google.visualization.DataTable();
barData.addColumn('string','Sales Type');
barData.addColumn('number','Lakhs');
barData.addColumn({type:'string', role:'annotation'});
barData.addRow(['Top6 Brands', Number(data.top6), data.top6.toFixed(2)]);
barData.addRow(['Netfox', Number(data.netfox), data.netfox.toFixed(2)]);
barData.addRow(['SonicWall', Number(data.sonic), data.sonic.toFixed(2)]);
let barChart = new google.visualization.ColumnChart(
document.getElementById("overviewBarChart")
);
let barOptions = {
  title:'Sales Comparison (Lakhs)',
  forceIFrame: true,
  backgroundColor:'transparent',
  height:420,
  bar:{
    groupWidth:'60%'
  },
  chartArea:{
    left:50,
    top:50,
    width:'90%',
    height:'70%'
  },
  legend:{position:'none'},
  colors:['#1E88E5'],
  hAxis:{
    title:'Sales Category',
    textStyle:{ color:'#000', fontSize:13 },
    titleTextStyle:{ color:'#000' },
    textPosition:'out'
  },
  vAxis:{
    title:'Sales Value (Lakhs)',
    textStyle:{ color:'#000', fontSize:13 },
    titleTextStyle:{ color:'#000' },
    gridlines:{ color:'#e5e7eb' },
    baselineColor:'#000',
    textPosition:'out',
    minValue:0
  },
  annotations:{
    alwaysOutside:true,
    textStyle:{ fontSize:12, bold:true, color:'#111827' }
  },
  animation:{
    startup:true,
    duration:800,
    easing:'out'
  }
};
barChart.draw(barData, barOptions);
setTimeout(() => {
  barChart.draw(barData, barOptions);
}, 300);
}
function loadOverviewMonths(){
getOverviewMonths()
.then(function(months){
const monthDropdown = document.getElementById("monthFilter");
monthDropdown.innerHTML = "";
months.forEach(m=>{
let opt = document.createElement("option");
opt.value = m;
opt.text = m;
monthDropdown.appendChild(opt);
});
loadOverviewDashboard();
});
}
function setOverviewPeriod(period, btn){
overviewPeriod = period;
document.querySelectorAll(".period-btn")
.forEach(b => b.classList.remove("active"));
btn.classList.add("active");
const monthDropdown = document.getElementById("monthFilter");
const quarterDropdown = document.getElementById("quarterFilter");
/* MONTHLY */
if(period === "MONTH"){
monthDropdown.disabled = false;
quarterDropdown.disabled = true;
quarterDropdown.value = "";
}
/* QUARTERLY */
else if(period === "QUARTER"){
monthDropdown.disabled = true;
monthDropdown.value = "";
quarterDropdown.disabled = false;
/* default quarter */
if(!quarterDropdown.value){
quarterDropdown.value = "Q1";
}
}
/* YEARLY */
else{
monthDropdown.disabled = true;
monthDropdown.value = "";
quarterDropdown.disabled = true;
quarterDropdown.value = "";
}
loadOverviewDashboard();
}
function loadDashboardFilters(){
getDashboardFilters()
.then(function(data){
const branchDropdown = document.getElementById("overviewBranch");
branchDropdown.innerHTML = "<option value='ALL'>All Branch</option>";
data.branches.forEach(b=>{
let opt = document.createElement("option");
opt.value = b;
opt.text = b;
branchDropdown.appendChild(opt);
});
const monthDropdown = document.getElementById("monthFilter");
monthDropdown.innerHTML = "";
data.months.forEach(m=>{
let opt = document.createElement("option");
opt.value = m;
opt.text = m;
monthDropdown.appendChild(opt);
});
/* ENABLE MONTH FILTER */
monthDropdown.disabled = false;
document.getElementById("quarterFilter").disabled = true;
/* Set default month */
if(data.months.length > 0){
monthDropdown.value = data.months[data.months.length - 1];
}
loadOverviewDashboard();
});
}
function renderTop6Summary(rows){
rows = rows.filter(r =>
  String(r[1]).toUpperCase() !== "TOTAL"
);
let brands = rows.map(r => r[1]);
let lakhs = rows.map(r => r[3]);
let percent = rows.map(r => r[4]);
let html = `
<table class="summary-matrix">
<tr>
<th>${currentSalesType === "NF" ? "Category" : "Brand"}</th>
${brands.map(b => `<th>${b}</th>`).join("")}
</tr>
<tr>
<td><b>Value in Lakhs</b></td>
${lakhs.map(v => `<td>${v}</td>`).join("")}
</tr>
<tr>
<td><b>%</b></td>
${percent.map(v => `<td>${v}</td>`).join("")}
</tr>
</table>
`;
document.getElementById("brandSummaryMatrix").innerHTML = html;
}
function buildPDFLayout(){
document.getElementById("pdfLayoutHeader").innerHTML = `
<div class="pdf-header">
<h1>eCAPS Dashboard</h1>
<h3>
${currentSalesType === "NF"
? "Netfox Sales Report"
: "Top 6 Brand Sales Report"}
</h3>
<p>
Branch :
${document.getElementById("branchSelect").value}
&nbsp; | &nbsp;
Month :
${document.getElementById("salesMonth").value}
</p>
</div>
`;
document.getElementById("pdfLayoutSummary").innerHTML =
document.getElementById("brandSummaryMatrix").innerHTML;
document.getElementById("pdfLayoutKPI").innerHTML =
`<div class="pdf-kpi-row">
${document.getElementById("top6KPIs").innerHTML}
</div>`;
document.getElementById("pdfLayoutDrillTitle").innerHTML =
document.getElementById("selectedBrandTitle").innerHTML;
document.getElementById("pdfLayoutDrillKPI").innerHTML =
`<div class="pdf-drill-kpi">
${document.querySelector(".kpi-row").innerHTML}
</div>`;
}
function renderTop6KPIs(rows, growth){
rows = rows.filter(r =>
  String(r[1]).toUpperCase() !== "TOTAL"
);
let total = 0;
rows.forEach(r => {
  total += Number(r[3]) || 0;
});
console.log(rows);
let topBrand = rows[0][1];
let topPercent = rows[0][4];
let avg = total / rows.length;
document.getElementById("top6KPIs").innerHTML = `
<div class="card">
<h4>Total Sales</h4>
<h2>${total.toFixed(2)}</h2>
</div>
<div class="card">
<h4>${currentSalesType === "NF" ? "Top Category" : "Top Brand"}</h4>
<h2>${topBrand}</h2>
<p>${topPercent}</p>
</div>
<div class="card">
<h4>${currentSalesType === "NF" ? "Total Categories" : "Total Brands"}</h4>
<h2>${rows.length}</h2>
</div>
<div class="card">
<h4>${currentSalesType === "NF" ? "Average / Category" : "Average / Brand"}</h4>
<h2>${avg.toFixed(2)}</h2>
</div>
<div class="card">
<h4>Growth</h4>
<h2>${growth}%</h2>
</div>
`;
}
function showBrandDrilldown(brand) {
  window.drilldownLoaded = false;
  let branch =
    document.getElementById("branchSelect").value;
  let month =
    document.getElementById("salesMonth").value;
  document.getElementById("brandDrilldown").style.display = "block";
  const _drilldownCall = currentSalesType === "NF"
    ? getNFDrilldownData(currentSalesType, brand, branch, month)
    : getBrandDrilldownData(currentSalesType, brand, branch, month);
  _drilldownCall
    .then(function(data) {
      console.log(data);
      document.getElementById("selectedBrandTitle").innerText =
        brand + " Drilldown";
      document.getElementById("drillSales").innerText =
        data.totalSales || "0";
      document.getElementById("drillPercent").innerText =
        (data.percent || "0") + "%";
      document.getElementById("drillGrowthMonth").innerText =
        (data.growthMonth || "0") + "%";
      document.getElementById("drillGrowthQuarter").innerText =
        (data.growthQuarter || "0") + "%";
      if(data.monthly && data.monthly.length > 0){
          drawMonthlyTrend(data.monthly);
      }else{
          document.getElementById("monthlyTrendChart").innerHTML = "";
          window.monthlyTrendChartObj = null;
      }
      if(data.branches && data.branches.length > 0){
          drawBranchContribution(data.branches);
      }else{
          document.getElementById("branchContributionChart").innerHTML = "";
          window.branchContributionChartObj = null;
      }
    window.drilldownLoaded = true;
    if(window.batchResolve){
        const fn = window.batchResolve;
        window.batchResolve = null;
        fn();
    }
    })
    .catch(function(err){
    console.error(err);
    window.drilldownLoaded = true;
    if(window.batchResolve){
        const fn = window.batchResolve;
        window.batchResolve = null;
        fn();
    }
    if(!batchMode){
        alert(err.message);
    }
});
}
function drawMonthlyTrend(monthly){
  if(!monthly || monthly.length === 0) return;
  let chartData = new google.visualization.DataTable();
  chartData.addColumn('string','Month');
  chartData.addColumn('number','Sales');
  chartData.addColumn({type:'string', role:'annotation'});
  monthly.forEach(row => {
    chartData.addRow([
      row[0],
      Number(row[1]),
      Number(row[1]).toFixed(2)
    ]);
  });
  window.monthlyTrendChartObj =
  new google.visualization.LineChart(
  document.getElementById("monthlyTrendChart")
  );
  let chart =
  window.monthlyTrendChartObj;
  chart.draw(chartData, {
    title:'Monthly Trend',
    height:400,
    legend:{position:'none'},
    pointSize:6,
    curveType:'function',
    annotations:{
      alwaysOutside:true
    },
    chartArea:{
    left:60,
    top:60,
    width:'85%',
    height:'70%'
    },
    hAxis:{
    slantedText:true,
    slantedTextAngle:35
    },
    animation:{
      startup:true,
      duration:800
    }
  });
}
function drawBranchContribution(branches){
  if(!branches || branches.length === 0) return;
  let data =
    new google.visualization.DataTable();
  data.addColumn('string','Branch');
  data.addColumn('number','Sales');
  data.addColumn({type:'string', role:'annotation'});
  branches.forEach(r=>{
    data.addRow([
      r[0],
      Number(r[1]),
      Number(r[1]).toFixed(2)
    ]);
  });
  window.branchContributionChartObj =
  new google.visualization.BarChart(
  document.getElementById(
  "branchContributionChart"
  )
  );
  let chart =
  window.branchContributionChartObj;
  chart.draw(data, {
    title:'Branch Contribution',
    height:400,
    legend:'none',
    annotations:{
      alwaysOutside:true
    },
    chartArea:{
      left:120,
      width:'70%'
    },
    animation:{
      startup:true,
      duration:800
    }
  });
}
function waitForPDFReady(callback){
    const timer = setInterval(function(){
        if(
            window.salesTrendChartObj &&
            window.salesPieChartObj &&
            window.drilldownLoaded
        ){
            clearInterval(timer);
            setTimeout(callback,500);
        }
    },200);
}
//OVERVIEW DAHSBOARD LOAD
// Was `window.onload = ...` in the original — that only works when this
// code runs during the initial page parse. Here scripts.js is injected
// after the HTML partials finish loading (see index.html), which is
// after the page's load event has already fired, so `window.onload`
// would never run. Since the DOM is already ready by this point, we
// just call it immediately instead.
(function(){
document.body.style.overflow = "hidden";
document.getElementById("dashboardContent")
.style.display = "none";
})();
/* =========================================
   PREMIUM QUOTE ANIMATION
========================================= */
const quotes = [
"Small steps every day create remarkable results.",
"Success is built through consistency.",
"Progress begins with action.",
"Great achievements start with clear vision.",
"Opportunities grow when teams work together."
];
const quoteText =
document.getElementById("quoteText");
let quoteIndex = 0;
function typeWriter(text, i = 0){
if(i < text.length){
quoteText.innerHTML += text.charAt(i);
setTimeout(() => {
typeWriter(text, i + 1);
},40);
}
}
function changeQuote(){
const quoteBox =
document.querySelector(".quote-box");
/* SWIPE OUT */
quoteBox.style.transform =
"translateX(-60px)";
quoteBox.style.opacity = 0;
/* WAIT */
setTimeout(() => {
/* CHANGE TEXT */
quoteText.innerHTML = "";
quoteIndex++;
if(quoteIndex >= quotes.length){
quoteIndex = 0;
}
/* SWIPE IN */
quoteBox.style.transform =
"translateX(0px)";
quoteBox.style.opacity = 1;
/* TYPE EFFECT */
typeWriter(quotes[quoteIndex]);
},700);
}
/* INITIAL */
quoteText.innerHTML = "";
typeWriter(quotes[0]);
/* LOOP */
setInterval(changeQuote, 6000);
/* =========================================
   LOGIN ENTER KEY SUPPORT
========================================= */
// Was wrapped in a DOMContentLoaded listener — same timing issue as
// window.onload above, so this runs immediately instead.
(function(){
const passwordInput =
document.getElementById("passwordInput");
if(passwordInput){
passwordInput.addEventListener("keypress", function(e){
if(e.key === "Enter"){
verifyLogin();
}
});
}
})();
/* =========================================
   RELOAD LUCIDE ICONS
========================================= */
setTimeout(() => {
if(window.lucide){
lucide.createIcons();
}
},500);
function exportPDF(){
  // Show PDF Header
  document.getElementById("pdfHeader").style.display = "block";
  document.getElementById("salesControls").style.display = "none";
  document.getElementById("pdfReportTitle").innerHTML =
    currentSalesType === "NF"
      ? "Netfox Sales Report"
      : currentSalesType === "TOP6"
      ? "Top 6 Brand Sales Report"
      : "SonicWall Sales Report";
  document.getElementById("pdfReportInfo").innerHTML =
    "Branch : " +
    document.getElementById("branchSelect").value +
    " | Month : " +
    document.getElementById("salesMonth").value +
    " | Generated : " +
    new Date().toLocaleString();
  // Hide Filters + Export Button
  const controls =
  document.getElementById("salesControls");
buildPDFLayout();
document.getElementById("pdfTrendChart").innerHTML =
`<img src="${window.salesTrendChartObj.getImageURI()}"
style="width:100%;height:100%;">`;
document.getElementById("pdfPieChart").innerHTML =
`<img src="${window.salesPieChartObj.getImageURI()}"
style="width:100%;height:100%;">`;
document.getElementById("pdfMonthlyChart").innerHTML =
`<img src="${window.monthlyTrendChartObj.getImageURI()}"
style="width:100%;height:100%;">`;
document.getElementById("pdfBranchChart").innerHTML =
`<img src="${window.branchContributionChartObj.getImageURI()}"
style="width:100%;height:100%;">`;
document.getElementById("pdfLayout").scrollTop = 0;
document.getElementById("pdfLayout").style.display = "block";
const element =
document.getElementById("pdfLayout");
  const reportName =
    currentSalesType + "_" +
    document.getElementById("branchSelect").value + "_" +
    document.getElementById("salesMonth").value;
  // Force browser reflow
  document.body.offsetHeight;
  // Wait for Google Charts to resize
  setTimeout(function(){
    html2pdf()
      .from(element)
      .set({
        margin: 0.1,
        filename: reportName + ".pdf",
        image: {
          type: 'jpeg',
          quality: 1
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollY: 0
        },
        pagebreak: {
          mode: ['avoid-all']
        },
        jsPDF: {
          unit: 'in',
          format: 'a4',
          orientation: 'portrait'
        }
      })
      .save()
      .then(function(){
        // Restore UI
        if(controls){
          controls.style.display = "flex";
        }
        document.getElementById("pdfLayout").style.display = "none";
        document.body.classList.remove("pdf-mode");
        document.getElementById("pdfHeader").style.display = "none";
        document.getElementById("salesControls").style.display = "flex";
      });
  }, 1500);
}
async function generateAllBranchPDF(){
  const reportType = document.getElementById("reportType").value;
  const month = document.getElementById("reportMonth").value;
  if(!month){
    alert("Select Month");
    return;
  }
  batchMode = true;
  showLoader();
  getSalesBranches(reportType)
  .then(async function(branches){
    await buildAllBranchPages(reportType, month, branches);
  })
  .catch(function(err){
    console.error(err);
    batchMode = false;
    hideLoader();
    alert("Could not load branch list");
  });
}
function createPDFPage(branch, month, reportType){
  let page = document.createElement("div");
  page.className = "pdf-page";
  page.innerHTML = `
    <div class="pdf-header">
      <h2>eCAPS Dashboard</h2>
      <h3>${reportType} Report</h3>
      <p>Branch : ${branch}</p>
      <p>Month : ${month}</p>
    </div>
  `;
  const summary =
    document.getElementById("brandSummaryMatrix");
  const kpis =
    document.getElementById("top6KPIs");
  const charts =
    document.getElementById("salesChartsWrapper");
  const drill =
    document.getElementById("brandDrilldown");
  if(summary)
    page.appendChild(summary.cloneNode(true));
  if(kpis)
    page.appendChild(kpis.cloneNode(true));
  if(charts)
    page.appendChild(charts.cloneNode(true));
  if(drill)
    page.appendChild(drill.cloneNode(true));
  return page;
}
async function buildAllBranchPages(reportType, month, branches){
  const container = document.getElementById("multiBranchPDF");
  container.innerHTML = `
<style>
  #multiBranchPDF{ background:#fff; width:794px; margin:0; padding:0; }
  #multiBranchPDF .pdf-page{
    width:794px; height:1050px; padding:24px 28px;
    box-sizing:border-box; overflow:hidden;
    page-break-after:always; background:#fff;
  }
  #multiBranchPDF .pdf-page:last-child{ page-break-after:auto; }
  #multiBranchPDF .pdf-inner{ width:100%; }
  /* Cloned single-report layout (ids converted to c- classes) */
  #multiBranchPDF .c-pdfLayout{
    display:block !important;
    width:100% !important;
    background:#fff;
    margin:0;
    padding:0;
    font-family:Arial,sans-serif;
    box-sizing:border-box;
  }
  #multiBranchPDF .c-pdfTrendChart,
  #multiBranchPDF .c-pdfPieChart,
  #multiBranchPDF .c-pdfMonthlyChart,
  #multiBranchPDF .c-pdfBranchChart{
    height:250px;
  }
  #multiBranchPDF .c-pdfLayoutDrillTitle{
    margin-top:15px;
    margin-bottom:10px;
    font-size:18px;
    font-weight:bold;
  }
  /* Keep the summary table inside the page width */
  #multiBranchPDF .summary-matrix{
    width:100% !important;
    table-layout:fixed !important;
    border-collapse:collapse !important;
    font-size:12px !important;
  }
  #multiBranchPDF .summary-matrix th,
  #multiBranchPDF .summary-matrix td{
    padding:8px 6px !important;
    overflow:hidden !important;
    text-overflow:ellipsis !important;
    white-space:nowrap !important;
  }
</style>`;
  let skipped = [];
  for(let i = 0; i < branches.length; i++){
    const branch = branches[i];
    const page = await buildBranchPage(reportType, branch, month);
    if(page){
      container.appendChild(page);
      // Give the browser time to finish rendering
      await wait(100);
    } else {
      skipped.push(branch);
    }
  }
  batchMode = false;
  if(container.querySelectorAll(".pdf-page").length === 0){
    hideLoader();
    alert("No branch has data for " + month);
    return;
  }
  if(skipped.length > 0){
    console.warn("Skipped branches (no data):", skipped.join(", "));
  }
  container.style.display = "block";
  container.querySelectorAll(".pdf-page").forEach(fitPageContent);
  exportMultiBranchPDF();
}
function fitPageContent(page){
  const inner = page.querySelector(".pdf-inner");
  if(!inner) return;
  const style = getComputedStyle(page);
  const available =
    page.clientHeight
    - parseFloat(style.paddingTop)
    - parseFloat(style.paddingBottom);
  const actual = inner.scrollHeight;
  if(actual > available){
    const k = (available / actual) * 0.99;
    // Uniform scale - no horizontal stretch
    inner.style.transformOrigin = "top center";
    inner.style.transform = "scale(" + k + ")";
    console.log("Page scaled to", Math.round(k * 100) + "%");
  }
}
function wait(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}
async function buildBranchPage(reportType,branch,month){
    resetSalesUI();
    currentSalesType=reportType;
    showSection("sales");
    const branchDropdown=document.getElementById("branchSelect");
    branchDropdown.innerHTML=
    `<option value="${branch}">${branch}</option>`;
    branchDropdown.value=branch;
    const months = await getSalesMonths(reportType, branch);
    if(!months || months.indexOf(month)==-1){
        console.log(branch+" skipped");
        return null;
    }
    const monthDropdown=document.getElementById("salesMonth");
    monthDropdown.innerHTML="";
    months.forEach(m=>{
        let opt=document.createElement("option");
        opt.value=m;
        opt.text=m;
        monthDropdown.appendChild(opt);
    });
    monthDropdown.value=month;
    await wait(300);
    window.salesTrendChartObj=null;
    window.salesPieChartObj=null;
    window.monthlyTrendChartObj=null;
    window.branchContributionChartObj=null;
    window.drilldownLoaded=false;
    await new Promise(resolve=>{
    window.batchResolve = resolve;
    loadSalesReport();
    });
    buildPDFLayout();
    document.getElementById("pdfTrendChart").innerHTML=
    `<img src="${window.salesTrendChartObj.getImageURI()}"
    style="width:100%;height:100%;">`;
    document.getElementById("pdfPieChart").innerHTML=
    `<img src="${window.salesPieChartObj.getImageURI()}"
    style="width:100%;height:100%;">`;
    document.getElementById("pdfMonthlyChart").innerHTML=
    window.monthlyTrendChartObj ?
    `<img src="${window.monthlyTrendChartObj.getImageURI()}"
    style="width:100%;height:100%;">` : "";
    document.getElementById("pdfBranchChart").innerHTML=
    window.branchContributionChartObj ?
    `<img src="${window.branchContributionChartObj.getImageURI()}"
    style="width:100%;height:100%;">` : "";
    await wait(100);
    const layoutClone=
    document.getElementById("pdfLayout").cloneNode(true);
    layoutClone.querySelectorAll("[id]").forEach(el=>{
        el.classList.add("c-"+el.id);
        el.removeAttribute("id");
    });
    layoutClone.classList.add("c-pdfLayout");
    layoutClone.removeAttribute("id");
    layoutClone.style.display="block";
    const page=document.createElement("div");
    page.className="pdf-page";
    const inner=document.createElement("div");
    inner.className="pdf-inner";
    inner.appendChild(layoutClone);
    page.appendChild(inner);
    console.log(branch+" completed");
    return page;
}
function exportMultiBranchPDF(){
  const element = document.getElementById("multiBranchPDF");
  element.style.display = "block";
  html2pdf()
    .from(element)
    .set({
      margin: 0.25,
      filename: "All_Branches_Report.pdf",
      image: {
        type: 'jpeg',
        quality: 1
      },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0
      },
      pagebreak: {
        mode: ['css'],
        after: '.pdf-page'
      },
      jsPDF: {
        unit: 'in',
        format: 'a4',
        orientation: 'portrait'
      }
    })
    .save()
    .then(function(){
      element.style.display = "none";
      hideLoader();
    });
}
