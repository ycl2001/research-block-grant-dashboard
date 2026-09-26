(function () {
  "use strict";

  const UTS_CODE = "3016";
  const START_YEAR = 2017;
  const END_YEAR = 2026;
  const numberFormat = new Intl.NumberFormat("en-AU");

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      const next = text[index + 1];
      if (quoted) {
        if (character === '"' && next === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field.replace(/\r$/, ""));
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }
    if (field || row.length) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
    }

    const [headers, ...data] = rows;
    return data.map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
    );
  }

  function formatCurrency(value) {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${numberFormat.format(Math.round(value))}`;
  }

  function formatPercent(value) {
    return `${value.toFixed(2)}%`;
  }

  function formatMovement(value) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)} pp`;
  }

  function shortProviderName(name) {
    const replacements = new Map([
      ["The University of Queensland", "Queensland"],
      ["The University of Western Australia", "Western Australia"],
      ["The University of Sydney", "Sydney"],
      ["University of New South Wales", "UNSW"],
      ["University of Technology Sydney", "UTS"],
      ["Queensland University of Technology", "Queensland Tech"],
      ["The Australian National University", "ANU"],
      ["Royal Melbourne Institute of Technology", "RMIT"]
    ]);
    return replacements.get(name) || name.replace(/^The University of /, "").replace(/ University$/, "");
  }

  function normalizeRbg(row) {
    return {
      code: row.HEP_Code,
      name: row.Provider_Name,
      year: Number(row.Year),
      state: row.State,
      cohort: row.Cohort,
      rsp: Number(row.RSP),
      rtp: Number(row.RTP),
      totalRbg: Number(row.Total_RBG),
      sectorTotal: Number(row.Sector_Total_RBG),
      providerShare: Number(row.Provider_Share),
      rank: Number(row.Annual_Rank),
      topFiveShare: Number(row.Top_Five_Share),
      endpointComparable: row.Endpoint_Comparable === "Yes",
      movement: row.Share_Movement_PP === "" ? null : Number(row.Share_Movement_PP)
    };
  }

  function getYearRecord(records, year, code) {
    return records.find((row) => row.year === year && row.code === code);
  }

  function renderHeadlineKpis(records) {
    const start = records.find((row) => row.year === START_YEAR);
    const end = records.find((row) => row.year === END_YEAR);
    const utsStart = getYearRecord(records, START_YEAR, UTS_CODE);
    const utsEnd = getYearRecord(records, END_YEAR, UTS_CODE);

    document.getElementById("top-five-2026").textContent = formatPercent(end.topFiveShare);
    document.getElementById("top-five-change").textContent = formatMovement(end.topFiveShare - start.topFiveShare);
    document.getElementById("uts-share-2026").textContent = formatPercent(utsEnd.providerShare);
    document.getElementById("uts-share-change").textContent = formatMovement(utsEnd.providerShare - utsStart.providerShare);
    document.getElementById("concentration-takeaway").textContent =
      `Sector concentration remained broadly stable from ${formatPercent(start.topFiveShare)} ` +
      `in ${START_YEAR} to ${formatPercent(end.topFiveShare)} in ${END_YEAR}, ` +
      `a ${formatMovement(end.topFiveShare - start.topFiveShare)} net change.`;
  }

  function buildYearlyData(records) {
    return [...new Set(records.map((row) => row.year))]
      .sort((a, b) => a - b)
      .map((year) => {
        const row = records.find((record) => record.year === year);
        return {
          year,
          topFiveShare: row.topFiveShare,
          sectorTotal: row.sectorTotal
        };
      });
  }

  function buildMovers(records) {
    const endpointRows = records.filter(
      (row) => row.year === END_YEAR && row.endpointComparable && row.movement !== null
    );
    const gains = [...endpointRows].sort((a, b) => b.movement - a.movement).slice(0, 5);
    const losses = [...endpointRows].sort((a, b) => a.movement - b.movement).slice(0, 5);
    return [...losses, ...gains].map((row) => ({
      code: row.code,
      name: row.name,
      shortName: shortProviderName(row.name),
      movement: row.movement,
      share2017: getYearRecord(records, START_YEAR, row.code).providerShare,
      share2026: row.providerShare
    }));
  }

  function populateInstitutionSelect(records) {
    const select = document.getElementById("institution-select");
    const latest = records.filter((row) => row.year === END_YEAR);
    const providers = latest
      .map((row) => ({ code: row.code, name: row.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "en-AU"));

    select.replaceChildren();
    providers.forEach((provider) => {
      const option = document.createElement("option");
      option.value = provider.code;
      option.textContent = provider.name;
      select.append(option);
    });
    select.value = UTS_CODE;
    select.disabled = false;
  }

  function renderHdrContext(hdrRows, selectedCode) {
    const panel = document.getElementById("hdr-context");
    if (selectedCode !== UTS_CODE) {
      panel.hidden = true;
      return;
    }

    const utsHdr = hdrRows
      .filter((row) => row.HEP_Code === UTS_CODE)
      .sort((a, b) => Number(a.Year) - Number(b.Year));
    const values = document.getElementById("hdr-values");
    values.replaceChildren();
    utsHdr.forEach((row) => {
      const item = document.createElement("div");
      item.className = "context-value";
      const year = document.createElement("span");
      year.textContent = `${row.Year} HDR completions`;
      const value = document.createElement("strong");
      value.textContent = row.Total_HDR_Completions || "Suppressed";
      item.append(year, value);
      values.append(item);
    });
    panel.hidden = false;
  }

  function updateInstitution(records, hdrRows, code) {
    const selected = records
      .filter((row) => row.code === code)
      .sort((a, b) => a.year - b.year);
    if (!selected.length) return;
    const first = selected[0];
    const latest = selected[selected.length - 1];

    document.getElementById("institution-total").textContent = formatCurrency(latest.totalRbg);
    document.getElementById("institution-rsp").textContent = formatCurrency(latest.rsp);
    document.getElementById("institution-rtp").textContent = formatCurrency(latest.rtp);
    document.getElementById("institution-share").textContent = formatPercent(latest.providerShare);
    document.getElementById("selected-institution-name").textContent = latest.name;
    document.getElementById("selected-institution-period").textContent =
      `Metric cards show the ${latest.year} grant year`;
    document.getElementById("funding-chart-title").textContent = `${latest.name}: RBG funding`;
    document.getElementById("share-chart-title").textContent = `${latest.name}: sector share`;

    let takeaway;
    if (first.year === latest.year) {
      takeaway = `${latest.name} accounted for ${formatPercent(latest.providerShare)} of sector RBG in ${latest.year}.`;
    } else {
      const direction = latest.providerShare > first.providerShare
        ? "increased"
        : latest.providerShare < first.providerShare
          ? "decreased"
          : "was unchanged";
      takeaway = `${latest.name} ${direction} its share of sector RBG from ` +
        `${formatPercent(first.providerShare)} in ${first.year} to ` +
        `${formatPercent(latest.providerShare)} in ${latest.year}.`;
    }
    document.getElementById("institution-share-takeaway").textContent = takeaway;
    window.DashboardCharts.renderInstitutionCharts(selected, latest.name);
    renderHdrContext(hdrRows, code);
  }

  function validateData(records) {
    const years = [...new Set(records.map((row) => row.year))].sort((a, b) => a - b);
    if (years.length !== 10 || years[0] !== START_YEAR || years.at(-1) !== END_YEAR) {
      throw new Error("RBG data does not cover every grant year from 2017 to 2026.");
    }
    for (const year of years) {
      const yearRows = records.filter((row) => row.year === year);
      const shareTotal = yearRows.reduce((sum, row) => sum + row.providerShare, 0);
      if (Math.abs(shareTotal - 100) > 0.0001) {
        throw new Error(`Provider shares do not sum to 100% in ${year}.`);
      }
    }
  }

  async function init() {
    const status = document.getElementById("data-status");
    try {
      if (!window.Plotly) throw new Error("The chart library could not be loaded.");
      const [rbgResponse, hdrResponse] = await Promise.all([
        fetch("data/processed/rbg_dashboard.csv"),
        fetch("data/processed/hdr_context.csv")
      ]);
      if (!rbgResponse.ok || !hdrResponse.ok) {
        throw new Error("The processed dashboard data could not be loaded.");
      }

      const [rbgText, hdrText] = await Promise.all([rbgResponse.text(), hdrResponse.text()]);
      const records = parseCSV(rbgText).map(normalizeRbg);
      const hdrRows = parseCSV(hdrText);
      validateData(records);

      renderHeadlineKpis(records);
      window.DashboardCharts.renderConcentrationChart(buildYearlyData(records));
      window.DashboardCharts.renderMovementChart(buildMovers(records));
      populateInstitutionSelect(records);
      updateInstitution(records, hdrRows, UTS_CODE);

      document.getElementById("institution-select").addEventListener("change", (event) => {
        updateInstitution(records, hdrRows, event.target.value);
      });
      status.hidden = true;
    } catch (error) {
      status.classList.add("status-message--error");
      status.textContent = `${error.message} Run a local web server from the repository root and refresh the page.`;
      console.error(error);
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
