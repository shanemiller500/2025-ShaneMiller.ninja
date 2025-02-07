"use client";

import React, { useEffect, useState, useRef } from "react";

const LiveStreamHeatmap = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket("wss://ws.coincap.io/prices?assets=ALL");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      for (const [symbol, price] of Object.entries(data)) {
        updateTradeInfo(symbol, parseFloat(price));
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      socket.close();
    };
  }, []);

  const updateTradeInfo = (symbol, price) => {
    setTradeInfoMap((prev) => {
      const prevPrice = prev[symbol]?.price;
      return {
        ...prev,
        [symbol]: {
          price,
          prevPrice,
        },
      };
    });
  };

  return (
    <div className="p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Live Stream Heatmap</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
        {Object.keys(tradeInfoMap).map((symbol) => {
          const { price, prevPrice } = tradeInfoMap[symbol];
          let bgColor = "";
          if (prevPrice !== undefined) {
            if (price > prevPrice) bgColor = "bg-green-500";
            else if (price < prevPrice) bgColor = "bg-red-500";
          }
          return (
            <div
              key={symbol}
              className={`p-4 rounded shadow text-center text-white ${bgColor}`}
            >
              <h5 className="font-bold">{symbol}</h5>
              <p>${price.toFixed(2)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveStreamHeatmap;

// "use client";

// import React, { useEffect, useState, useRef } from "react";

// // Hardcoded array of the top 100 crypto assets (CoinCap IDs)
// const TOP_100_ASSETS = [
//   // Top 50
//   "bitcoin",            // BTC
//   "ethereum",           // ETH
//   "tether",             // USDT
//   "binance-coin",       // BNB
//   "usd-coin",           // USDC
//   "xrp",                 // XRP
//   "cardano",            // ADA
//   "solana",             // SOL
//   "dogecoin",           // DOGE
//   "polkadot",           // DOT
//   "monero",              // XMR
//   "shiba-inu",          // SHIB
//   "tron",               // TRX
//   "avalanche",          // AVAX
//   "wrapped-bitcoin",    // WBTC
//   "litecoin",           // LTC
//   "uniswap",            // UNI
//   "chainlink",          // LINK
//   "bitcoin-cash",       // BCH
//   "stellar",            // XLM
//   "vechain",            // VET
//   "filecoin",           // FIL
//   "ethereum-classic",   // ETC
//   "cosmos",             // ATOM
//   "algorand",           // ALGO
//   "internet-computer",  // ICP
//   "flow",               // FLOW
//   "decentraland",       // MANA
//   "aave",               // AAVE
//   "theta-token",        // THETA
//   "hedera-hashgraph",   // HBAR
//   "tezos",              // XTZ
//   "elrond-erd-2",       // EGLD
//   "the-sandbox",        // SAND
//   "frax",               // FRAX
//   "axie-infinity",      // AXS
//   "enjin-coin",         // ENJ
//   "celsius",            // CEL
//   "bitcoin-sv",         // BSV
//   "eos",                // EOS
//   "neo",                // NEO
//   "amp",                // AMP
//   "chiliz",             // CHZ
//   "gala",               // GALA
//   "iota",               // MIOTA
//   "pancakeswap",        // CAKE
//   "sushi",              // SUSHI
//   "curve-dao-token",    // CRV
//   "helium",             // HNT
//   "zilliqa",
//   "maker",
//   "compound",
//   "kusama",
//   "terra-luna",
//   "1inch",
//   "bitcoin-gold",
//   "digibyte",
//   "revain",
//   "arweave",
//   "the-graph",
//   "ren",
//   "omg-network",
//   "loopring",
//   "celo",
//   "qtum"
// ];

// const LiveStreamHeatmap = () => {
//   const [tradeInfoMap, setTradeInfoMap] = useState({});
//   const socketRef = useRef(null);

//   useEffect(() => {
//     // Delay the initialization by 3 seconds
//     const timer = setTimeout(() => {
//       // Build a comma-separated string of asset IDs from the TOP_100_ASSETS array
//       const assetsParam = TOP_100_ASSETS.join(",");
//       console.log("Subscribing to assets:", assetsParam);

//       // Open a WebSocket connection for the top 100 assets
//       const socket = new WebSocket(`wss://ws.coincap.io/prices?assets=${assetsParam}`);
//       socketRef.current = socket;

//       socket.onopen = () => {
//         console.log("WebSocket connection established");
//       };

//       socket.onmessage = (event) => {
//         const data = JSON.parse(event.data);
//         // Loop through each asset's update and update state accordingly
//         for (const [asset, price] of Object.entries(data)) {
//           updateTradeInfo(asset, parseFloat(price));
//         }
//       };

//       socket.onerror = (error) => {
//         console.error("WebSocket error:", error);
//       };
//     }, 1000);

//     // Cleanup: clear the timer and close the socket on unmount
//     return () => {
//       clearTimeout(timer);
//       if (socketRef.current) {
//         socketRef.current.close();
//       }
//     };
//   }, []);

//   // Function to update asset price information while preserving previous prices
//   const updateTradeInfo = (asset, price) => {
//     setTradeInfoMap((prev) => {
//       const prevPrice = prev[asset]?.price;
//       return {
//         ...prev,
//         [asset]: {
//           price,
//           prevPrice,
//         },
//       };
//     });
//   };

//   return (
//     <div className="p-4 rounded shadow">
//       <h2 className="text-xl font-bold mb-4">Live Stream Heatmap</h2>
//       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
//         {TOP_100_ASSETS.map((asset) => {
//           const { price, prevPrice } = tradeInfoMap[asset] || {};
//           let bgColor = "";
//           if (prevPrice !== undefined) {
//             if (price > prevPrice) bgColor = "bg-green-500";
//             else if (price < prevPrice) bgColor = "bg-red-500";
//           }
//           return (
//             <div
//               key={asset}
//               className={`rounded shadow text-center text-white ${bgColor}`}
//             >
//               <h5 className="font-bold">{asset.toUpperCase()}</h5>
//               <p>{price ? `$${price.toFixed(2)}` : "Loading..."}</p>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// };

// export default LiveStreamHeatmap;
