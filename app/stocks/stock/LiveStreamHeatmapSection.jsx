// "use client";

// import React, { useState, useEffect, useRef } from "react";
// import { API_TOKEN } from "@/utils/config";
// import { formatDate } from "@/utils/formatters";

// const LiveStreamHeatmapSection = () => {
//   const [tradeInfoMap, setTradeInfoMap] = useState({});
//   const [marketStatus, setMarketStatus] = useState(null);
//   const socketRef = useRef(null);

//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       // Delay the WebSocket initialization by 1 second.
//       const timerId = setTimeout(() => {
//         socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

//         socketRef.current.onopen = () => {
//           console.info("Socket connection opened");
//           checkMarketStatus();
//         };

//         socketRef.current.onmessage = (event) => {
//           const response = JSON.parse(event.data);
//           if (response.type === "ping") {
//             // Ignore pings.
//           } else if (response.type === "trade" && response.data && response.data.length > 0) {
//             const tradeData = response.data[0];
//             const symbol = tradeData.s;
//             const tradePrice = parseFloat(tradeData.p);

//             setTradeInfoMap((prev) => {
//               const prevData = prev[symbol];
//               // Determine the background color based on price change:
//               // - Green if the new price is higher than the previous price.
//               // - Red if the new price is lower.
//               // - Default neutral color if no previous data or no change.
//               let bgColor = "bg-gray-100 dark:bg-gray-600";
//               if (prevData) {
//                 if (tradePrice > prevData.price) {
//                   bgColor = "bg-green-300 dark:bg-green-700";
//                 } else if (tradePrice < prevData.price) {
//                   bgColor = "bg-red-300 dark:bg-red-700";
//                 }
//               }

//               return {
//                 ...prev,
//                 [symbol]: {
//                   timestamp: tradeData.t,
//                   price: tradePrice,
//                   info: "$" + tradePrice.toFixed(2),
//                   bgColor, // dynamically set background color
//                 },
//               };
//             });
//           }
//         };

//         socketRef.current.onerror = (error) => {
//           console.error("WebSocket error:", error);
//         };
//       }, 1000); // 1-second delay

//       // Cleanup: clear the timeout and close the socket on unmount.
//       return () => {
//         clearTimeout(timerId);
//         if (socketRef.current) {
//           socketRef.current.close();
//         }
//       };
//     }
//   }, []);

//   const checkMarketStatus = () => {
//     fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`)
//       .then((res) => res.json())
//       .then((data) => {
//         setMarketStatus(data);
//         if (data.isOpen) {
//           subscribeToSymbols();
//         }
//       })
//       .catch((error) => console.error("Error checking market status:", error));
//   };

//   const subscribeToSymbols = () => {
//     const symbols = [
//       "AAPL",
//       "MSFT",
//       "AMZN",
//       "GOOGL",
//       "TSLA",
//       "FB",
//       "NVDA",
//       "PYPL",
//       "ASML",
//       "ADBE",
//       "CMCSA",
//       "CSCO",
//       "PEP",
//       "NFLX",
//       "AVGO",
//       "INTU",
//       "AMD",
//       "IBM",
//       "TXN",
//       "QCOM",
//       "COST",
//       "ABBV",
//       "CRM",
//       "ACN",
//       "T",
//       "NKE",
//       "NEE",
//       "DHR",
//       "ORCL",
//       "UNH",
//       "FIS",
//       "BMY",
//       "LLY",
//       "CVX",
//       "LIN",
//       "SBUX",
//       "HD",
//       "AMGN",
//       "MDT",
//       "HON",
//       "MO",
//       "NVO",
//       "MMM",
//       "VRTX",
//       "REGN",
//       "TMO",
//       "LMT",
//       "PYPL",
//       "SBUX",
//       "NOW",
//       "ZM",
//       "MA",
//       "CME",
//       "UPS",
//       "TMUS",
//       "CHTR",
//       "SNOW",
//     ];
//     symbols.forEach((symbol) => {
//       const subscribeMsg = JSON.stringify({ type: "subscribe", symbol });
//       socketRef.current.send(subscribeMsg);
//       console.info(`Subscribed to ${symbol}`);
//     });
//   };

//   return (
//     <section className="rounded p-4">
//       <h2 className="text-2xl font-bold mb-4">Live Stream Heatmap</h2>
//       <p className="mb-4">
//         A live streaming heat map. This is live trades manipulating the color change; if the price goes up it is green, if it goes down from the last price red, no change it remains neutral.
//       </p>
//       {marketStatus && (
//         <div
//           id="marketStatus"
//           className={`mb-4 p-2 rounded ${
//             marketStatus.isOpen ? "bg-green-500" : "bg-red-500"
//           } text-white`}
//         >
//           {marketStatus.isOpen
//             ? `Market is open | Current time: ${formatDate(marketStatus.t, "short")}`
//             : "The markets are now closed. Check back during market hours for the latest updates!"}
//         </div>
//       )}
//       <div id="tradeInfoGrid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-">
//         {Object.keys(tradeInfoMap).map((symbol) => {
//           const info = tradeInfoMap[symbol];
//           return (
//             <div key={symbol} id={`tradeInfo_${symbol}`} className="p-1">
//               <div className={`text-center p-3 rounded ${info.bgColor}`}>
//                 <h5 className="font-bold">{symbol}</h5>
//                 {info.info}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </section>
//   );
// };

// export default LiveStreamHeatmapSection;






"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_TOKEN } from "@/utils/config";
import { formatDate } from "@/utils/formatters";
import { motion } from "framer-motion";

const LiveStreamHeatmapSection = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const [marketStatus, setMarketStatus] = useState(null);
  const [loadingSpinner, setLoadingSpinner] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Delay the WebSocket initialization by 1 second.
      const timerId = setTimeout(() => {
        socketRef.current = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);

        socketRef.current.onopen = () => {
          console.info("Socket connection opened");
          checkMarketStatus();
        };

        socketRef.current.onmessage = (event) => {
          const response = JSON.parse(event.data);
          if (response.type === "ping") {
            // Ignore pings.
          } else if (response.type === "trade" && response.data && response.data.length > 0) {
            const tradeData = response.data[0];
            const symbol = tradeData.s;
            const tradePrice = parseFloat(tradeData.p);

            setTradeInfoMap((prev) => {
              const prevData = prev[symbol];
              // Determine the background color based on price change.
              let bgColor = "bg-gray-100 dark:bg-gray-600";
              if (prevData) {
                if (tradePrice > prevData.price) {
                  bgColor = "bg-green-300 dark:bg-green-700";
                } else if (tradePrice < prevData.price) {
                  bgColor = "bg-red-300 dark:bg-red-700";
                }
              }

              return {
                ...prev,
                [symbol]: {
                  timestamp: tradeData.t,
                  price: tradePrice,
                  info: "$" + tradePrice.toFixed(2),
                  bgColor, // dynamically set background color
                },
              };
            });
          }
        };

        socketRef.current.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
      }, 1000); // 1-second delay

      // Cleanup: clear the timeout and close the socket on unmount.
      return () => {
        clearTimeout(timerId);
        if (socketRef.current) {
          socketRef.current.close();
        }
      };
    }
  }, []);

  const checkMarketStatus = () => {
    fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=US&token=${API_TOKEN}`)
      .then((res) => res.json())
      .then((data) => {
        setMarketStatus(data);
        if (data.isOpen) {
          subscribeToSymbols();
        }
      })
      .catch((error) => console.error("Error checking market status:", error));
  };

  const subscribeToSymbols = () => {
    const symbols = [
      "AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "FB", "NVDA", "PYPL",
      "ASML", "ADBE", "CMCSA", "CSCO", "PEP", "NFLX", "AVGO", "INTU",
      "AMD", "IBM", "TXN", "QCOM", "COST", "ABBV", "CRM", "ACN", "T",
      "NKE", "NEE", "DHR", "ORCL", "UNH", "FIS", "BMY", "LLY", "CVX",
      "LIN", "SBUX", "HD", "AMGN", "MDT", "HON", "MO", "NVO", "MMM",
      "VRTX", "REGN", "TMO", "LMT", "PYPL", "SBUX", "NOW", "ZM", "MA",
      "CME", "UPS", "TMUS", "CHTR", "SNOW",
    ];
    symbols.forEach((symbol) => {
      const subscribeMsg = JSON.stringify({ type: "subscribe", symbol });
      socketRef.current.send(subscribeMsg);
      console.info(`Subscribed to ${symbol}`);
    });
  };

  // Show spinner overlay for 2 seconds on initial load.
  useEffect(() => {
    const spinnerTimeout = setTimeout(() => {
      setLoadingSpinner(false);
    }, 2000);
    return () => clearTimeout(spinnerTimeout);
  }, []);

  return (
    <section className="rounded p-4 relative">
      {loadingSpinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-4">Live Stream Heatmap</h2>
      <p className="mb-4">
        A live streaming heat map. This is live trades manipulating the color change;
        if the price goes up it is green, if it goes down from the last price red,
        no change it remains neutral.
      </p>
      {marketStatus && (
        <div
          id="marketStatus"
          className={`mb-4 p-2 rounded ${marketStatus.isOpen ? "bg-green-500" : "bg-red-500"} text-white`}
        >
          {marketStatus.isOpen
            ? `Market is open | Current time: ${formatDate(marketStatus.t, "short")}`
            : "The markets are now closed. Check back during market hours for the latest updates!"}
        </div>
      )}
      <div id="tradeInfoGrid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {Object.keys(tradeInfoMap).map((symbol) => {
          const info = tradeInfoMap[symbol];
          return (
            <motion.div
              key={symbol}
              className="p-1"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className={`text-center p-3 rounded ${info.bgColor}`}>
                <h5 className="font-bold">{symbol}</h5>
                {info.info}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default LiveStreamHeatmapSection;
