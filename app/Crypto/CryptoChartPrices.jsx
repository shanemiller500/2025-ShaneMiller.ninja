"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

const API_KEY = "mud9spxbq6i1MTj1Q52GKEzdL3wPgyeAeNo20dzB";

const CryptoChartPrices = () => {
  const [cryptoSymbol, setCryptoSymbol] = useState("bitcoin");
  const [chartData, setChartData] = useState([]);
  const [cryptoDetails, setCryptoDetails] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  async function fetchCryptoData(cryptoName) {
    const end = Date.now();
    const start = end - 24 * 60 * 60 * 1000;
    const url = `https://api.coincap.io/v2/assets/${cryptoName}/history?interval=m1&start=${start}&end=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.data || data.data.length === 0) return [];
      return data.data.map((entry) => ({
        t: entry.time,
        y: parseFloat(entry.priceUsd),
      }));
    } catch (error) {
      console.error("Error fetching crypto data:", error);
      return [];
    }
  }

  async function fetchCryptoDetails(cryptoName) {
    const url = `https://api.coincap.io/v2/assets/${cryptoName}`;
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error fetching crypto details:", error);
      return null;
    }
  }

  async function updateChart() {
    setLoadingChart(true);
    const data = await fetchCryptoData(cryptoSymbol);
    setChartData(data);
    const details = await fetchCryptoDetails(cryptoSymbol);
    setCryptoDetails(details?.data || null);
    setLoadingChart(false);
  }

  useEffect(() => {
    updateChart();
  }, [cryptoSymbol]);

  useEffect(() => {
    if (canvasRef.current && chartData.length > 0) {
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current, {
        type: "line",
        data: {
          datasets: [
            {
              label: `${cryptoSymbol.charAt(0).toUpperCase() + cryptoSymbol.slice(1)} Price (USD)`,
              data: chartData,
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.1)",
              fill: true,
            },
          ],
        },
        options: {
          scales: {
            x: {
              type: "time",
              time: {
                unit: "hour",
                tooltipFormat: "MMM D, HH:mm",
              },
              title: {
                display: true,
                text: "Time",
              },
            },
            y: {
              title: {
                display: true,
                text: "Price in USD",
              },
            },
          },
          parsing: {
            xAxisKey: "t",
            yAxisKey: "y",
          },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }
  }, [chartData]);

  const handleSearch = async (e) => {
    e.preventDefault();
    updateChart();
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">
      <h2 className="text-3xl font-bold text-center mb-4">Crypto Chart & Prices</h2>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Enter crypto symbol (e.g. bitcoin)"
          value={cryptoSymbol}
          onChange={(e) => setCryptoSymbol(e.target.value)}
          className="p-2 border border-gray-300 rounded w-full sm:w-auto dark:bg-gray-700 dark:border-gray-600 focus:outline-none"
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none">
          Search
        </button>
      </form>
      {loadingChart ? (
        <p className="text-center">Loading chart...</p>
      ) : (
        <div className="w-full h-80 mb-4">
          <canvas ref={canvasRef} className="w-full h-full"></canvas>
        </div>
      )}
      {cryptoDetails && (
        <div className="border rounded p-4 shadow dark:border-gray-700 dark:bg-gray-700">
          <h3 className="text-xl font-bold mb-2">
            {cryptoDetails.name} ({cryptoDetails.symbol})
          </h3>
          <h3
            className="text-2xl font-bold mb-2"
            style={{
              color: parseFloat(cryptoDetails.changePercent24Hr) >= 0 ? "#4CAF50" : "#F44336",
            }}
          >
            ${parseFloat(cryptoDetails.priceUsd).toFixed(2)} |{" "}
            {parseFloat(cryptoDetails.changePercent24Hr).toFixed(2)}%{" "}
            {parseFloat(cryptoDetails.changePercent24Hr) >= 0 ? "↑" : "↓"}
          </h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="font-semibold p-1">Rank:</td>
                <td className="p-1">{cryptoDetails.rank}</td>
                <td className="font-semibold p-1">Supply:</td>
                <td className="p-1">{parseInt(cryptoDetails.supply).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="font-semibold p-1">Max Supply:</td>
                <td className="p-1">
                  {cryptoDetails.maxSupply
                    ? parseInt(cryptoDetails.maxSupply).toLocaleString()
                    : "N/A"}
                </td>
                <td className="font-semibold p-1">Market Cap (USD):</td>
                <td className="p-1">
                  {parseFloat(cryptoDetails.marketCapUsd).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr>
                <td className="font-semibold p-1">24Hr Volume (USD):</td>
                <td className="p-1">
                  {parseFloat(cryptoDetails.volumeUsd24Hr).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="font-semibold p-1">VWAP (24Hr):</td>
                <td className="p-1">
                  {cryptoDetails.vwap24Hr
                    ? parseFloat(cryptoDetails.vwap24Hr).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "N/A"}
                </td>
              </tr>
            </tbody>
          </table>
          <a
            href={cryptoDetails.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {cryptoDetails.name} Blockchain Explorer
          </a>
        </div>
      )}
    </div>
  );
};

export default CryptoChartPrices;
