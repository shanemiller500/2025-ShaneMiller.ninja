"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, useMotionValue } from "framer-motion";

const WidgetCrypto = () => {
  // Store metadata and live price info.
  const [metaData, setMetaData] = useState<{ [id: string]: any }>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<{
    [id: string]: { price: number; prevPrice?: number };
  }>({});
  const socketRef = useRef<WebSocket | null>(null);

  // For the scrolling ticker, we need the width (in px) of one set of cards.
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);

  // A motion value to control the horizontal offset.
  const x = useMotionValue(0);

  // State to track whether the user is dragging.
  const [isDragging, setIsDragging] = useState(false);

  // Speed in pixels per second.
  const speed = 50;

  // Fetch metadata (including initial price) from CoinCap's REST API.
  useEffect(() => {
    const fetchMetaData = async () => {
      try {
        const response = await fetch("https://api.coincap.io/v2/assets");
        const json = await response.json();
        const metaMap: { [id: string]: any } = {};
        json.data.forEach((asset: any) => {
          metaMap[asset.id] = asset;
        });
        setMetaData(metaMap);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      }
    };

    fetchMetaData();
  }, []);

  // Compute the top 10 asset IDs based on their rank using useMemo.
  const topAssetIds = useMemo(() => {
    return Object.keys(metaData)
      .sort(
        (a, b) => parseInt(metaData[a].rank, 10) - parseInt(metaData[b].rank, 10)
      )
      .slice(0, 10);
  }, [metaData]);

  // Once metadata is available, initialize tradeInfoMap with initial prices.
  useEffect(() => {
    if (topAssetIds.length > 0 && Object.keys(tradeInfoMap).length === 0) {
      const initialMap: { [id: string]: { price: number } } = {};
      topAssetIds.forEach((id) => {
        const asset = metaData[id];
        if (asset && asset.priceUsd) {
          initialMap[id] = { price: parseFloat(asset.priceUsd) };
        }
      });
      setTradeInfoMap(initialMap);
    }
  }, [metaData, topAssetIds]);

  // Subscribe to the WebSocket using only the top ranked asset IDs.
  // The WebSocket connection is delayed slightly to ensure initial prices are loaded.
  useEffect(() => {
    if (topAssetIds.length === 0) return;
    const websocketTimeout = setTimeout(() => {
      const assets = topAssetIds.join(",");
      const socket = new WebSocket(`wss://ws.coincap.io/prices?assets=${assets}`);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket connection established (widget)");
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        for (const [id, price] of Object.entries(data)) {
          updateTradeInfo(id, parseFloat(price as string));
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error in widget:", error);
      };
    }, 2000);

    return () => {
      clearTimeout(websocketTimeout);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [topAssetIds]);

  // Update live price data while preserving the previous price.
  // Only update when the price changes to avoid unnecessary re-renders.
  const updateTradeInfo = (id: string, price: number) => {
    setTradeInfoMap((prev) => {
      const current = prev[id];
      if (current && current.price === price) return prev;
      return {
        ...prev,
        [id]: { price, prevPrice: current?.price },
      };
    });
  };

  // Measure the width of one set of cards (needed for the scrolling ticker)
  // and update on window resize.
  useEffect(() => {
    const measureWidth = () => {
      if (innerRef.current) {
        setContentWidth(innerRef.current.offsetWidth);
      }
    };
    measureWidth();
    window.addEventListener("resize", measureWidth);
    return () => {
      window.removeEventListener("resize", measureWidth);
    };
  }, [topAssetIds]);

  // Continuous auto-scrolling effect using requestAnimationFrame.
  useEffect(() => {
    let animationFrame: number;
    let lastTime: number | null = null;

    const animate = (time: number) => {
      if (lastTime === null) {
        lastTime = time;
      }
      const delta = time - lastTime;
      lastTime = time;

      // Only update the auto-scroll if the user is not dragging and contentWidth is known.
      if (!isDragging && contentWidth > 0) {
        let newX = x.get() - speed * (delta / 1000);

        // When newX goes beyond -contentWidth, wrap it back.
        if (newX <= -contentWidth) {
          newX = newX + contentWidth;
        }
        // Likewise, if newX is positive (e.g., if user dragged right), wrap it.
        if (newX > 0) {
          newX = newX - contentWidth;
        }
        x.set(newX);
      }
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isDragging, contentWidth, x]);

  // Helper: modulo function that works for negative numbers.
  const mod = (n: number, m: number) => ((n % m) + m) % m;

  // Render a single "heatmap" style card.
  const renderCard = (id: string) => {
    const assetMeta = metaData[id];
    const tradeInfo = tradeInfoMap[id] || {};
    const { price, prevPrice } = tradeInfo;

    // Set background color and arrow symbol based on price movement.
    let bgColor = "bg-gray-300";
    let arrowSymbol = "";
    if (prevPrice !== undefined) {
      if (price > prevPrice) {
        bgColor = "bg-green-500";
        arrowSymbol = "↑";
      } else if (price < prevPrice) {
        bgColor = "bg-red-500";
        arrowSymbol = "↓";
      }
    } else if (assetMeta) {
      // Use 24Hr change to decide initial color.
      const change = parseFloat(assetMeta.changePercent24Hr);
      if (change > 0) {
        bgColor = "bg-green-500";
        arrowSymbol = "↑";
      } else if (change < 0) {
        bgColor = "bg-red-500";
        arrowSymbol = "↓";
      }
    }

    const displaySymbol = assetMeta ? assetMeta.symbol : id.toUpperCase();
    const rankText = assetMeta ? `#${assetMeta.rank}` : "#N/A";
    const percentChange = assetMeta
      ? parseFloat(assetMeta.changePercent24Hr).toFixed(2)
      : "0.00";

    return (
      <div
        key={id}
        className={`p-2 m-1 rounded text-white text-center ${bgColor} whitespace-nowrap`}
      >
        <div className="text-xs font-medium">{rankText}</div>
        <div className="text-sm font-bold">{displaySymbol}</div>
        <div className="text-xs">
          {price !== undefined ? (
            <>
              {`$${Number(price).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${arrowSymbol}`}
            </>
          ) : (
            "Loading..."
          )}
        </div>
        <div className="text-xs">{percentChange}%</div>
      </div>
    );
  };

  return (
    <div className="max-w-[700px] overflow-hidden relative">
      <div className="p-2">
        <p className="text-xs text-gray-500 text-center">
          Top 10 Ranked Cryptos Live Pricing Data
        </p>
      </div>

      {/* The marquee container is draggable and uses the motion value x.
          It contains two copies of the cards for a seamless looping effect. */}
      <motion.div
        className="flex cursor-grab"
        style={{ x }}
        drag="x"
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          setIsDragging(false);
          // Normalize the position to keep it within [-contentWidth, 0)
          const currentX = x.get();
          const adjustedX = -mod(-currentX, contentWidth);
          x.set(adjustedX);
        }}
      >
        {/* First copy (its width is measured) */}
        <div className="flex" ref={innerRef}>
          {topAssetIds.map((id) => renderCard(id))}
        </div>
        {/* Duplicate for a seamless loop */}
        <div className="flex">
          {topAssetIds.map((id) => renderCard(id))}
        </div>
      </motion.div>

      <div className="p-2">
        <p className="text-xs text-gray-500 text-center">
          See more crypto data{" "}
          <a href="/Crypto" className="text-indigo-500 underline">
            here
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default WidgetCrypto;
