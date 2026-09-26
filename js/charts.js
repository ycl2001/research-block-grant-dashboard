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

  function plot(elementId, traces, layout) {
    return window.Plotly.react(
      elementId,
      traces,
      { ...baseLayout, ...layout },
      config
    );
  }

  function renderConcentrationChart(yearlyData) {
    const years = yearlyData.map((row) => row.year);
    const values = yearlyData.map((row) => row.topFiveShare);
    const labels = values.map((value, index) =>
      index === 0 || index === values.length - 1 ? `${value.toFixed(2)}%` : ""
    );

    return plot("concentration-chart", [
      {
        type: "scatter",
        mode: "lines+markers+text",
        x: years,
        y: values,
        line: { color: colours.blue, width: 3 },
        marker: {
          color: years.map((year) => year === 2021 ? colours.teal : colours.blue),
          size: years.map((year) => year === 2021 ? 10 : 7)
        },
        text: labels,
        textposition: ["bottom right", "top center", "top center", "top center", "top center", "top center", "top center", "top center", "top center", "bottom left"],
        textfont: { color: colours.navy, size: 12 },
        customdata: yearlyData.map((row) => row.sectorTotal),
        hovertemplate: "<b>%{x}</b><br>Top-five share: %{y:.2f}%<extra></extra>"
      }
    ], {
      xaxis: {
        title: { text: "Grant year", standoff: 14 },
        tickmode: "array",
        tickvals: years,
        fixedrange: true,
        showgrid: false,
        zeroline: false
      },
      yaxis: {
        title: { text: "Share of annual sector RBG (%)", standoff: 10 },
        ticksuffix: "%",
        range: [46.7, 49.5],
        fixedrange: true,
        gridcolor: colours.grid,
        zeroline: false
      },
      annotations: [
        {
          x: 2021,
          y: values[years.indexOf(2021)],
          text: "Additional RSP funding<br>during COVID-19",
          showarrow: true,
          arrowhead: 0,
          arrowcolor: colours.teal,
          ax: -46,
          ay: -55,
          align: "left",
          font: { color: colours.teal, size: 11 },
          bgcolor: "rgba(255,255,255,0.9)",
          borderpad: 3
        }
      ]
    });
  }

  function renderMovementChart(movers) {
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
        text: ordered.map((row) => `${row.movement >= 0 ? "+" : ""}${row.movement.toFixed(2)} pp`),
        textposition: "outside",
        cliponaxis: false,
        customdata: ordered.map((row) => [row.name, row.share2017, row.share2026]),
        hovertemplate:
          "<b>%{customdata[0]}</b><br>2017: %{customdata[1]:.2f}%<br>" +
          "2026: %{customdata[2]:.2f}%<br>Movement: %{x:+.2f} pp<extra></extra>"
      }
    ], {
      margin: { l: 118, r: 62, t: 20, b: 50 },
      xaxis: {
        title: { text: "Percentage-point change in annual sector share", standoff: 12 },
        ticksuffix: " pp",
        range: [-1.45, 2.2],
        fixedrange: true,
        gridcolor: colours.grid,
        zeroline: true,
        zerolinecolor: "#9ba8ae",
        zerolinewidth: 1
      },
      yaxis: {
        fixedrange: true,
        automargin: true
      },
      bargap: 0.34
    });
  }

  function renderInstitutionCharts(records, providerName) {
    const years = records.map((row) => row.year);
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
        hovertemplate: "<b>Total RBG</b><br>%{x}: $%{y:,.0f}<extra></extra>"
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "RSP",
        x: years,
        y: records.map((row) => row.rsp),
        line: { color: colours.teal, width: 2 },
        marker: { size: 6 },
        hovertemplate: "<b>RSP</b><br>%{x}: $%{y:,.0f}<extra></extra>"
      },
      {
        type: "scatter",
        mode: "lines+markers",
        name: "RTP",
        x: years,
        y: records.map((row) => row.rtp),
        line: { color: colours.blue, width: 2 },
        marker: { size: 6 },
        hovertemplate: "<b>RTP</b><br>%{x}: $%{y:,.0f}<extra></extra>"
      }
    ], {
      margin: { l: 72, r: 18, t: 45, b: 55 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.14,
        font: { size: 11 }
      },
      xaxis: { ...commonAxis, title: { text: "Grant year", standoff: 14 } },
      yaxis: {
        title: { text: "Allocation (A$)", standoff: 8 },
        tickformat: "$.2s",
        fixedrange: true,
        gridcolor: colours.grid,
        rangemode: "tozero",
        zeroline: false
      }
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
        hovertemplate: `<b>${providerName}</b><br>%{x}: %{y:.2f}%<extra></extra>`
      }
    ], {
      margin: { l: 68, r: 18, t: 28, b: 55 },
      xaxis: { ...commonAxis, title: { text: "Grant year", standoff: 14 } },
      yaxis: {
        title: { text: "Sector share (%)", standoff: 8 },
        ticksuffix: "%",
        tickformat: ".2f",
        fixedrange: true,
        gridcolor: colours.grid,
        rangemode: "tozero",
        zeroline: false
      }
    });
  }

  window.DashboardCharts = {
    renderConcentrationChart,
    renderMovementChart,
    renderInstitutionCharts
  };
})();
