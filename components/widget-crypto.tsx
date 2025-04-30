"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, useMotionValue } from "framer-motion";

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY;
if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Please set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart your dev server."
  );
}

const WidgetCrypto = () => {
  const [metaData, setMetaData] = useState<{ [id: string]: any }>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<{
    [id: string]: { price: number; prevPrice?: number };
  }>({});
  const socketRef = useRef<WebSocket | null>(null);

  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 50;

  // 1) Fetch top-10 assets by rank
  useEffect(() => {
    if (!API_KEY) return;
    const fetchMeta = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=10&apiKey=${API_KEY}`
        );
        const json = await res.json();
        const map: { [id: string]: any } = {};
        (Array.isArray(json.data) ? json.data : []).forEach((asset: any) => {
          map[asset.id] = asset;
        });
        setMetaData(map);
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };
    fetchMeta();
  }, []);

  // 2) Compute the top 10 IDs (they’re already sorted by rank from the API)
  const topAssetIds = useMemo(() => Object.keys(metaData), [metaData]);

  // 3) Seed initial prices
  useEffect(() => {
    if (topAssetIds.length && !Object.keys(tradeInfoMap).length) {
      const initial: { [id: string]: { price: number } } = {};
      topAssetIds.forEach((id) => {
        const usd = metaData[id]?.priceUsd;
        if (usd) initial[id] = { price: parseFloat(usd) };
      });
      setTradeInfoMap(initial);
    }
  }, [metaData, topAssetIds]);

  // 4) Delay by 2s then open WS with only top 10 + apiKey
  useEffect(() => {
    if (!API_KEY || !topAssetIds.length) return;
    const timer = setTimeout(() => {
      const assets = topAssetIds.join(",");
      const socket = new WebSocket(
        `wss://wss.coincap.io/prices?assets=${assets}&apiKey=${API_KEY}`
      );
      socketRef.current = socket;

      socket.onopen = () =>
        console.log("WebSocket connection established (WidgetCrypto)");
      socket.onerror = (err) =>
        console.error("WebSocket error in widget:", err);

      socket.onmessage = (evt) => {
        let data: any;
        try {
          data = JSON.parse(evt.data);
        } catch {
          // ignore non-JSON messages (like “Unauthorized”)
          return;
        }
        setTradeInfoMap((prev) => {
          const next = { ...prev };
          Object.entries(data).forEach(([id, priceStr]) => {
            const price = parseFloat(priceStr as string);
            const prevPrice = prev[id]?.price;
            next[id] = { price, prevPrice };
          });
          return next;
        });
      };
    }, 2000);

    return () => {
      clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [topAssetIds]);

  // 5) Measure width for marquee looping
  useEffect(() => {
    const measure = () => {
      if (innerRef.current) setContentWidth(innerRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  // 6) Auto‐scroll with requestAnimationFrame
  useEffect(() => {
    let raf: number;
    let last: number | null = null;
    const animate = (t: number) => {
      if (last === null) last = t;
      const delta = t - last;
      last = t;
      if (!isDragging && contentWidth > 0) {
        let newX = x.get() - speed * (delta / 1000);
        if (newX <= -contentWidth) newX += contentWidth;
        if (newX > 0) newX -= contentWidth;
        x.set(newX);
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, contentWidth, x]);

  // 7) Render one “card”
  const renderCard = (id: string) => {
    const md = metaData[id];
    const ti = tradeInfoMap[id] || {};
    const { price, prevPrice } = ti;
    let bg = "bg-gray-300",
      arrow = "";
    if (prevPrice !== undefined) {
      if (price > prevPrice) bg = "bg-green-500", (arrow = "↑");
      else if (price < prevPrice) bg = "bg-red-500", (arrow = "↓");
    } else if (md) {
      const change = parseFloat(md.changePercent24Hr);
      if (change > 0) bg = "bg-green-500", (arrow = "↑");
      else if (change < 0) bg = "bg-red-500", (arrow = "↓");
    }
    const symbol = md?.symbol || id.toUpperCase();
    const rankText = md ? `#${md.rank}` : "#N/A";
    const pct = md ? parseFloat(md.changePercent24Hr).toFixed(2) : "0.00";

    return (
      <div
        key={id}
        className={`p-2 m-1 rounded text-white text-center ${bg} whitespace-nowrap`}
      >
        <div className="text-xs font-medium">{rankText}</div>
        <div className="text-sm font-bold">{symbol}</div>
        <div className="text-xs">
          {price !== undefined
            ? `$${price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${arrow}`
            : "Loading..."}
        </div>
        <div className="text-xs">{pct}%</div>
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

      <motion.div
        className="flex cursor-grab"
        style={{ x }}
        drag="x"
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          setIsDragging(false);
          // normalize within [-width, 0)
          const mod = (n: number, m: number) => ((n % m) + m) % m;
          const cur = x.get();
          x.set(-mod(-cur, contentWidth));
        }}
      >
        <div className="flex" ref={innerRef}>
          {topAssetIds.map(renderCard)}
        </div>
        <div className="flex">{topAssetIds.map(renderCard)}</div>
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
