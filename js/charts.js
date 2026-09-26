(function () {
  "use strict";

  const colours = {
    navy: "#123d59",
    blue: "#2f6f9f",
    teal: "#008b82",
    coral: "#b55d52",
    muted: "#5f6d75",
    grid: "#e6ebed",
    paper: "#ffffff"
  };

  const baseLayout = {
    font: {
      family: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: colours.muted,
      size: 12
    },
    paper_bgcolor: colours.paper,
    plot_bgcolor: colours.paper,
    margin: { l: 62, r: 22, t: 28, b: 55 },
    hoverlabel: {
      bgcolor: colours.navy,
      bordercolor: colours.navy,
      font: { color: "#ffffff", size: 12 }
    },
    showlegend: false
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    scrollZoom: false
  };

  function isCompactViewport() {
    return window.matchMedia?.("(max-width: 680px)").matches ?? false;
  }

  function formatCurrency(value) {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (absolute >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${Math.round(value).toLocaleString("en-AU")}`;
  }

  function plot(elementId, traces, layout) {
    return window.Plotly.react(
      elementId,
      traces,
      { ...baseLayout, ...layout },
      config
    );
  }

  function renderConcentrationChart(yearlyData) {
    const compact = isCompactViewport();
    const years = yearlyData.map((row) => row.year);
    const values = yearlyData.map((row) => row.topFiveShare);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const covidValue = values[years.indexOf(2021)];

    return plot("concentration-chart", [
      {
        type: "scatter",
        mode: "lines+markers",
        x: years,
        y: values,
        line: { color: colours.blue, width: 3 },
        marker: {
          color: years.map((year) => year === 2021 ? colours.teal : colours.blue),
          size: years.map((year) => year === 2021 ? 10 : 7)
        },
        customdata: yearlyData.map((row) => row.sectorTotal),
        hovertemplate: "<b>Grant year: %{x}</b><br>Top-five share: %{y:.2f}%<extra></extra>"
      }
    ], {
      margin: compact
        ? { l: 56, r: 30, t: 58, b: 52 }
        : { l: 76, r: 58, t: 58, b: 58 },
      xaxis: {
        title: { text: "Grant year", standoff: 14 },
        tickmode: "array",
        tickvals: years,
        range: [2016.55, 2026.45],
        fixedrange: true,
        showgrid: false,
        zeroline: false
      },
      yaxis: {
        title: { text: "Share of annual sector RBG (%)", standoff: 10 },
        ticksuffix: "%",
        tickformat: ".1f",
        dtick: 1,
        range: [45, 50],
        fixedrange: true,
        gridcolor: colours.grid,
        zeroline: false
      },
      annotations: [
        {
          x: years[0],
          y: firstValue,
          text: `<b>2017</b><br>${firstValue.toFixed(2)}%`,
          showarrow: false,
          xanchor: "left",
          xshift: 9,
          yshift: -30,
          align: "left",
          font: { color: colours.navy, size: compact ? 10 : 11 }
        },
        {
          x: years[years.length - 1],
          y: lastValue,
          text: `<b>2026</b><br>${lastValue.toFixed(2)}%`,
          showarrow: false,
          xanchor: "right",
          xshift: -8,
          yshift: -30,
          align: "right",
          font: { color: colours.navy, size: compact ? 10 : 11 }
        },
        {
          x: 2021,
          y: covidValue,
          text: compact
            ? "2021<br>Additional COVID-19<br>RSP funding"
            : "2021 · Additional RSP funding during COVID-19",
          showarrow: true,
          arrowhead: 0,
          arrowwidth: 1,
          arrowcolor: colours.teal,
          ax: compact ? 22 : 75,
          ay: -43,
          align: compact ? "center" : "left",
          font: { color: colours.teal, size: compact ? 9 : 10 },
          bgcolor: "rgba(255,255,255,0.88)",
          borderpad: 2
        }
      ],
      hovermode: "closest"
    });
  }

  function renderMovementChart(movers) {
    const compact = isCompactViewport();
    const ordered = [...movers].sort((a, b) => a.movement - b.movement);
    const coloursByProvider = ordered.map((row) => {
      if (row.code === "3016") return colours.teal;
      return row.movement < 0 ? colours.coral : colours.blue;
    });

    return plot("movement-chart", [
      {
        type: "bar",
        orientation: "h",
        x: ordered.map((row) => row.movement),
        y: ordered.map((row) => row.shortName),
        marker: { color: coloursByProvider },
        text: compact
          ? []
          : ordered.map((row) => `${row.movement >= 0 ? "+" : ""}${row.movement.toFixed(2)} pp`),
        textposition: "outside",
        textfont: { color: colours.navy, size: 12 },
        cliponaxis: false,
        customdata: ordered.map((row) => [
          row.name,
          row.share2017,
          row.share2026,
          `${row.movement >= 0 ? "+" : ""}${row.movement.toFixed(2)} pp`
        ]),
        hovertemplate:
          "<b>%{customdata[0]}</b><br><br>2017 share: %{customdata[1]:.2f}%<br>" +
          "2026 share: %{customdata[2]:.2f}%<br>Change: %{customdata[3]}<extra></extra>"
      }
    ], {
      margin: compact
        ? { l: 116, r: 22, t: 46, b: 58 }
        : { l: 196, r: 104, t: 54, b: 62 },
      xaxis: {
        title: { text: "Percentage-point change in annual sector share", standoff: 12 },
        ticksuffix: " pp",
        tickformat: ".1f",
        range: compact ? [-1.45, 2.15] : [-1.65, 2.25],
        fixedrange: true,
        gridcolor: colours.grid,
        zeroline: true,
        zerolinecolor: "#9ba8ae",
        zerolinewidth: 1
      },
      yaxis: {
        fixedrange: true,
        automargin: false,
        tickfont: { size: compact ? 10 : 12 }
      },
      bargap: 0.42,
      annotations: [
        {
          x: 0.02,
          xref: "paper",
          y: 1.08,
          yref: "paper",
          text: "Loss of sector share",
          showarrow: false,
          xanchor: "left",
          font: { color: colours.coral, size: compact ? 9 : 10 }
        },
        {
          x: 0.98,
          xref: "paper",
          y: 1.08,
          yref: "paper",
          text: "Gain in sector share",
          showarrow: false,
          xanchor: "right",
          font: { color: colours.blue, size: compact ? 9 : 10 }
        }
      ],
      hovermode: "closest"
    });
  }

  function renderInstitutionCharts(records, providerName) {
    const compact = isCompactViewport();
    const years = records.map((row) => row.year);
    const hoverData = records.map((row) => [
      formatCurrency(row.totalRbg),
      formatCurrency(row.rsp),
      formatCurrency(row.rtp),
      `${row.providerShare.toFixed(2)}%`
    ]);
    const institutionHover =
      `<b>${providerName}</b><br><br>Grant year: %{x}<br>` +
      "Total RBG: %{customdata[0]}<br>RSP: %{customdata[1]}<br>" +
      "RTP: %{customdata[2]}<br>Sector share: %{customdata[3]}<extra></extra>";
    const commonAxis = {
      tickmode: "array",
      tickvals: years,
      fixedrange: true,
      showgrid: false,
      zeroline: false
    };

    plot("institution-funding-chart", [
      {
        type: "scatter",
        mode: "lines+markers",
        name: "Total RBG",
        x: years,
        y: records.map((row) => row.totalRbg),
        line: { color: colours.navy, width: 3 },
        marker: { size: 7 },
        customdata: hoverData,
        hovertemplate: institutionHover
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "RSP",
        x: years,
        y: records.map((row) => row.rsp),
        line: { color: colours.teal, width: 2 },
        marker: { size: 6 },
        customdata: hoverData,
        hovertemplate: institutionHover
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "RTP",
        x: years,
        y: records.map((row) => row.rtp),
        line: { color: colours.blue, width: 2 },
        marker: { size: 6 },
        customdata: hoverData,
        hovertemplate: institutionHover
      }
    ], {
      margin: compact
        ? { l: 62, r: 14, t: 56, b: 54 }
        : { l: 76, r: 24, t: 54, b: 58 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.16,
        font: { size: 11 }
      },
      xaxis: { ...commonAxis, title: { text: "Grant year", standoff: 14 } },
      yaxis: {
        title: { text: "Allocation (A$)", standoff: 8 },
        tickformat: "$.3s",
        fixedrange: true,
        gridcolor: colours.grid,
        rangemode: "tozero",
        zeroline: false
      },
      hovermode: "closest"
    });

    plot("institution-share-chart", [
      {
        type: "scatter",
        mode: "lines+markers",
        x: years,
        y: records.map((row) => row.providerShare),
        line: { color: colours.teal, width: 3 },
        marker: { color: colours.teal, size: 7 },
        fill: "tozeroy",
        fillcolor: "rgba(0, 139, 130, 0.08)",
        customdata: hoverData,
        hovertemplate: institutionHover
      }
    ], {
      margin: compact
        ? { l: 58, r: 20, t: 32, b: 54 }
        : { l: 70, r: 28, t: 32, b: 58 },
      xaxis: { ...commonAxis, title: { text: "Grant year", standoff: 14 } },
      yaxis: {
        title: { text: "Sector share (%)", standoff: 8 },
        ticksuffix: "%",
        tickformat: ".2f",
        fixedrange: true,
        gridcolor: colours.grid,
        rangemode: "tozero",
        zeroline: false
      },
      hovermode: "closest"
    });
  }

  window.DashboardCharts = {
    renderConcentrationChart,
    renderMovementChart,
    renderInstitutionCharts
  };
})();
