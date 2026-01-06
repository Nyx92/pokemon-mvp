"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Bar,
  ReferenceLine,
} from "recharts";

import { mapConditionToAPI } from "../../utils/mapCondition";
import type { CardItem } from "@/types/card";
import type { MarketData, PriceHistoryPoint } from "@/types/market";

// --- Tooltip types local to the chart ---
type PriceTooltipPayload = {
  dataKey?: string | number;
  value?: number | string | null;
};

type PriceTooltipProps = {
  active?: boolean;
  payload?: PriceTooltipPayload[];
  label?: string | number;
};

// helper to format DD/MM (no year)
const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
  });

// env-based FX rate (USD -> SGD)
const usdToSgdRate = Number(process.env.NEXT_PUBLIC_USD_TO_SGD_RATE ?? "1.29");

// Custom tooltip that shows price + volume + listed price
const PriceTooltip: React.FC<PriceTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const marketPoint = payload.find((p) => p.dataKey === "price");
  const listedPoint = payload.find((p) => p.dataKey === "listedPrice");
  const volumePoint = payload.find((p) => p.dataKey === "volume");

  return (
    <Box sx={{ p: 1.2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>

      {marketPoint && typeof marketPoint.value === "number" && (
        <Typography variant="body2">
          Market (SGD): {marketPoint.value.toFixed(2)}
        </Typography>
      )}

      {listedPoint && typeof listedPoint.value === "number" && (
        <Typography variant="body2">
          Listed (SGD): {listedPoint.value.toFixed(2)}
        </Typography>
      )}

      {volumePoint && typeof volumePoint.value === "number" && (
        <Typography variant="body2">Volume: {volumePoint.value}</Typography>
      )}
    </Box>
  );
};

interface CardMarketChartProps {
  card: CardItem;
}

const CardMarketChart: React.FC<CardMarketChartProps> = ({ card }) => {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const isForSale = card.forSale && card.status !== "sold";
  const language = (card as any).language ?? "english";
  const condition = card.condition ?? "";

  useEffect(() => {
    if (!card.tcgPlayerId) return;

    const mapping = mapConditionToAPI(card.condition);

    const fetchMarket = async () => {
      setLoadingMarket(true);
      try {
        const res = await fetch(
          `/api/pricetracker/${card.tcgPlayerId}?language=${encodeURIComponent(
            language
          )}&condition=${encodeURIComponent(condition)}`
        );
        const json = await res.json();
        const cardData = json?.data;

        if (!cardData) {
          setMarketData(null);
          return;
        }

        let historyRaw: any[] = [];
        let conditionLabel = "";
        let marketPrice: number | null = null;

        if (mapping.type === "graded") {
          const grade = mapping.grade;
          const gradeData = cardData?.ebay?.grades?.[grade];

          historyRaw = (gradeData?.history ?? []) as any[];
          marketPrice =
            typeof gradeData?.market === "number" ? gradeData.market : null;
          conditionLabel = card.condition || `PSA ${grade}`;
        } else {
          const key = mapping.key;
          const historyByCond = cardData?.priceHistory?.conditions ?? {};
          const priceByCond = cardData?.prices?.conditions ?? {};

          let sourceHistory = historyByCond[key]?.history as any[] | undefined;
          let sourcePrice = priceByCond[key]?.market as number | undefined;
          let usedKey = key;

          if (!sourceHistory || sourceHistory.length === 0) {
            sourceHistory = historyByCond["Near Mint"]?.history as
              | any[]
              | undefined;
            sourcePrice = priceByCond["Near Mint"]?.market as
              | number
              | undefined;
            usedKey = "Near Mint";
          }

          historyRaw = sourceHistory ?? [];
          marketPrice = typeof sourcePrice === "number" ? sourcePrice : null;

          conditionLabel =
            usedKey === key ? usedKey : `${key} (no data, showing Near Mint)`;
        }

        const history: PriceHistoryPoint[] = historyRaw.map((h: any) => ({
          date: h.date,
          market: h.market, // USD
          volume: h.volume ?? 0,
        }));

        setMarketData({
          conditionLabel,
          history,
          marketPrice,
        });
      } catch (e) {
        console.error("Market fetch error:", e);
        setMarketData(null);
      } finally {
        setLoadingMarket(false);
      }
    };

    fetchMarket();
  }, [card.tcgPlayerId, card.condition, language, condition]);

  // Loading
  if (loadingMarket) {
    return (
      <Box
        sx={{
          border: "1px solid #e6e6e6",
          borderRadius: 2,
          backgroundColor: "#fff",
          overflow: "hidden",
          p: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Fetching market data...
        </Typography>
      </Box>
    );
  }

  // No data
  if (
    !marketData ||
    !Array.isArray(marketData.history) ||
    marketData.history.length === 0
  ) {
    return (
      <Box
        sx={{
          border: "1px solid #e6e6e6",
          borderRadius: 2,
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 2, py: 1.2, borderBottom: "1px solid #eee" }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#111" }}>
            Global Market Data
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#6b7280", mt: 0.2 }}>
            Compare values across international card markets
          </Typography>
        </Box>

        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No price data available for this card
          </Typography>
        </Box>
      </Box>
    );
  }

  // Build chart data, converting USD -> SGD
  const chartData = marketData.history.map((h, idx, arr) => ({
    dateLabel: formatShortDate(h.date),
    price: h.market * usdToSgdRate,
    volume: h.volume,
    listedPrice:
      isForSale && typeof card.price === "number" && idx === arr.length - 1
        ? card.price
        : null,
  }));

  return (
    <Box
      sx={{
        border: "1px solid #e6e6e6",
        borderRadius: 2,
        backgroundColor: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Header inside chart */}
      <Box sx={{ px: 2, py: 1.2, borderBottom: "1px solid #eee" }}>
        <Typography sx={{ fontSize: 16, fontWeight: 900, color: "#111" }}>
          Global Market Data
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#6b7280", mt: 0.2 }}>
          Compare values across international card markets
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Price & volume history —{" "}
            <strong>{marketData.conditionLabel}</strong>
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Market (SGD) & Volume
          </Typography>
        </Box>

        <Box
          sx={{
            width: "100%",
            height: 220,
            bgcolor: "#fafafa",
            borderRadius: 2,
            border: "1px solid #eee",
            px: 2,
            py: 1.5,
            position: "relative",
          }}
        >
          {/* Legend bottom-right (inside) */}
          {isForSale && (
            <Box
              sx={{
                position: "absolute",
                bottom: 6,
                right: 12,
                display: "flex",
                alignItems: "center",
                gap: 0.6,
                background: "rgba(255,255,255,0.8)",
                px: 1,
                py: 0.3,
                borderRadius: 1,
                backdropFilter: "blur(4px)",
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "#d32f2f",
                  border: "2px solid #b71c1c",
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Listed Price (SGD)
              </Typography>
            </Box>
          )}

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 0, bottom: 30 }}
              onMouseMove={(state: any) => {
                if (
                  state?.isTooltipActive &&
                  typeof state?.activeTooltipIndex === "number"
                ) {
                  setActiveIndex(state.activeTooltipIndex);
                } else {
                  setActiveIndex(null);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />

              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: "#757575" }}
                tickLine={false}
                axisLine={{ stroke: "#e0e0e0" }}
              />

              {/* left Y: price (SGD) */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "#757575" }}
                tickLine={false}
                axisLine={{ stroke: "#e0e0e0" }}
                width={60}
              />

              {/* right Y: volume */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "#9e9e9e" }}
                tickLine={false}
                axisLine={{ stroke: "#e0e0e0" }}
              />

              <Tooltip content={<PriceTooltip />} />

              {/* vertical cursor line */}
              {activeIndex !== null &&
                chartData[activeIndex] &&
                chartData[activeIndex].dateLabel && (
                  <ReferenceLine
                    x={chartData[activeIndex].dateLabel}
                    stroke="#1976d2"
                    strokeDasharray="3 3"
                  />
                )}

              {/* volume bars (right axis) */}
              <Bar
                yAxisId="right"
                dataKey="volume"
                name="volume"
                barSize={18}
                fill="#bbdefb"
                radius={[4, 4, 0, 0]}
              />

              {/* market line (left axis) */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="price"
                name="price"
                stroke="#1976d2"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />

              {/* listed price dot at last point */}
              {isForSale && typeof card.price === "number" && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="listedPrice"
                  name="listedPrice"
                  stroke="transparent"
                  strokeWidth={0}
                  dot={{
                    r: 6,
                    stroke: "#b71c1c",
                    strokeWidth: 2,
                    fill: "#d32f2f",
                  }}
                  activeDot={{
                    r: 8,
                    stroke: "#b71c1c",
                    strokeWidth: 2,
                    fill: "#d32f2f",
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Box>
  );
};

export default CardMarketChart;
