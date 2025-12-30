"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import GavelIcon from "@mui/icons-material/Gavel";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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

interface CardDetailDialogProps {
  open: boolean;
  card: CardItem | null;
  onClose: () => void;
}

type PriceHistoryPoint = {
  date: string; // ISO
  market: number;
  volume: number; // number of items sold
};

type MarketData = {
  conditionLabel: string; // e.g. "PSA 10" or "Near Mint"
  history: PriceHistoryPoint[];
  marketPrice: number | null;
};

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
          Market (USD): {marketPoint.value.toFixed(2)}
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

const CardDetailDialog: React.FC<CardDetailDialogProps> = ({
  open,
  card,
  onClose,
}) => {
  const { data: session } = useSession();
  const isAdmin = session?.user && (session.user as any).role === "admin";
  const isOwner = session?.user?.id === card?.owner?.id;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Reset when card changes / dialog reopens
  useEffect(() => {
    if (open) {
      setActiveImageIndex(0);
      setLiked(false);
      setActiveIndex(null);
    }
  }, [open, card?.id]);

  useEffect(() => {
    if (!card?.tcgPlayerId || !open) return;

    const mapping = mapConditionToAPI(card.condition);

    const fetchMarket = async () => {
      setLoadingMarket(true);
      try {
        const res = await fetch(
          `/api/pricetracker/${card.tcgPlayerId}?graded=${
            mapping.type === "graded"
          }`
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
          market: h.market,
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
  }, [open, card?.tcgPlayerId, card?.condition]);

  if (!card) return null;

  const isForSale = card.forSale && card.status !== "sold";
  const likesCount = card.likesCount ?? 0;

  const hasHistory =
    !!marketData &&
    Array.isArray(marketData.history) &&
    marketData.history.length > 0;

  const chartData =
    hasHistory && marketData
      ? marketData.history.map((h, idx, arr) => ({
          dateLabel: formatShortDate(h.date),
          price: h.market,
          volume: h.volume,
          listedPrice:
            card.forSale &&
            typeof card.price === "number" &&
            idx === arr.length - 1
              ? card.price
              : null,
        }))
      : [];

  const safeText = (val?: string | null) =>
    val && val.trim().length > 0 ? val : "-";

  // shared styles for footer buttons
  const footerButtonSx = {
    textTransform: "none",
    borderColor: "#1976D2",
    color: "#1976D2",
    "&:hover": {
      borderColor: "#1976D2",
      backgroundColor: "rgba(0,0,0,0.06)",
    },
  } as const;

  const handleBuyNow = async () => {
    if (!card || !card.price) return;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: card.id,
          title: card.title,
          price: card.price,
          imageUrls: card.imageUrls ?? [],
        }),
      });

      if (!res.ok) {
        console.error("Failed to create checkout session");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned from Stripe");
      }
    } catch (err) {
      console.error("Error calling /api/checkout:", err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      {/* Floating close button */}
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 3,
          backgroundColor: "rgba(0,0,0,0.04)",
          "&:hover": {
            backgroundColor: "rgba(0,0,0,0.08)",
          },
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent
        sx={{
          pt: 4,
          pb: 2,
          px: 4,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
          }}
        >
          {/* Left: images */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                position: "relative",
                borderRadius: 3,
                overflow: "hidden",
                backgroundColor: "#f8f8f8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                px: 2,
                py: 3,
                mb: 2,
                boxShadow: 3,
              }}
            >
              <img
                src={card.imageUrls[activeImageIndex] || "/placeholder.png"}
                alt={`${card.title} large`}
                style={{
                  width: "100%",
                  maxHeight: 420,
                  objectFit: "contain",
                  display: "block",
                }}
              />

              {/* Market mode: like toggle */}
              {isOwner && (
                <IconButton
                  onClick={() => setLiked((prev) => !prev)}
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "rgba(255,255,255,0.9)",
                    "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
                  }}
                >
                  {liked ? (
                    <FavoriteIcon color="error" />
                  ) : (
                    <FavoriteBorderIcon />
                  )}
                </IconButton>
              )}

              {/* Owner mode: likes pill */}
              {!isOwner && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    backgroundColor: "rgba(255,255,255,0.96)",
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    boxShadow: 1,
                  }}
                >
                  <FavoriteIcon fontSize="small" color="error" />
                  <Typography variant="body2" fontWeight={600}>
                    {likesCount.toLocaleString()} likes
                  </Typography>
                </Box>
              )}

              {/* Status chips on top-right of image */}
              <Box
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "flex",
                  gap: 1,
                }}
              >
                {card.status === "sold" && (
                  <Chip
                    label="Sold"
                    size="small"
                    sx={{
                      backgroundColor: "#A15C5C",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
                {isForSale && (
                  <Chip
                    label="For Sale"
                    size="small"
                    sx={{
                      backgroundColor: "#3FA796",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
                {!isForSale && card.status !== "sold" && (
                  <Chip
                    label="NFS"
                    size="small"
                    sx={{
                      backgroundColor: "#9E9E9E",
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                )}
              </Box>
            </Box>

            {card.imageUrls.length > 1 && (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {card.imageUrls.map((url, i) => (
                  <Box
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: "pointer",
                      border:
                        i === activeImageIndex
                          ? "2px solid #1976d2"
                          : "1px solid #ddd",
                    }}
                  >
                    <img
                      src={url}
                      alt={`Thumb ${i + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Right: details */}
          <Box
            sx={{
              flex: 1.1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* Title */}
            <Typography variant="h6" fontWeight={700}>
              {card.title}
            </Typography>

            {/* Price row */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mt: 1,
              }}
            >
              {isForSale && card.price != null ? (
                <Typography variant="h5" fontWeight={700} color="primary">
                  SGD ${card.price.toFixed(2)}
                </Typography>
              ) : (
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  color="text.secondary"
                >
                  Not for sale
                </Typography>
              )}

              <Button
                variant="text"
                size="small"
                sx={{ textTransform: "none" }}
                onClick={() => {
                  console.log("Check market price for", card.id);
                }}
              >
                Check market price
              </Button>
            </Box>

            {/* Market data block */}
            {loadingMarket && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                Fetching market data...
              </Typography>
            )}

            {!loadingMarket && hasHistory && (
              <Box sx={{ width: "100%", mt: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    mb: 1,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    Price & volume history —{" "}
                    <strong>{marketData?.conditionLabel}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Market (USD) & Volume
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
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={chartData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                      onMouseMove={(state) => {
                        if (
                          state.isTooltipActive &&
                          typeof state.activeTooltipIndex === "number"
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

                      {/* left Y: price */}
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
            )}

            {!loadingMarket && !marketData && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                No price data available for this card
              </Typography>
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* Meta grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                rowGap: 0.6,
                columnGap: 2.5,
                fontSize: "0.9rem",
              }}
            >
              <Typography color="text.secondary">Condition:</Typography>
              <Typography fontWeight={500}>
                {safeText(card.condition)}
              </Typography>

              <Typography color="text.secondary">Set:</Typography>
              <Typography fontWeight={500}>{safeText(card.setName)}</Typography>

              <Typography color="text.secondary">Rarity:</Typography>
              <Typography fontWeight={500}>{safeText(card.rarity)}</Typography>

              <Typography color="text.secondary">Owner:</Typography>
              <Typography fontWeight={500}>
                {card.owner ? card.owner.username || card.owner.email : "-"}
              </Typography>
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* Description */}
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Description
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: "pre-line" }}
                color="text.primary"
              >
                {safeText(card.description)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      {/* Actions differ by mode */}
      <DialogActions
        sx={{
          px: 4,
          py: 2.5,
          borderTop: "1px solid #eee",
          display: "flex",
          justifyContent: "flex-end",
          gap: 1.5,
        }}
      >
        {!isOwner ? (
          <>
            <Button
              variant="outlined"
              startIcon={<GavelIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("Leave offer", card.id)}
            >
              Leave offer
            </Button>

            <Button
              variant="contained"
              color="primary"
              startIcon={<ShoppingCartIcon />}
              sx={{
                textTransform: "none",
                backgroundColor: "#1976D2",
                "&:hover": { backgroundColor: "#333" },
              }}
              disabled={!isForSale}
              onClick={handleBuyNow}
            >
              Buy now
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<LocalOfferIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("View offers", card.id)}
            >
              View offers
            </Button>

            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              sx={footerButtonSx}
              onClick={() => console.log("Promote listing", card.id)}
            >
              Edit listing
            </Button>

            {isAdmin && (
              <Button
                variant="outlined"
                startIcon={<DeleteOutlineIcon />}
                sx={{
                  textTransform: "none",
                  borderColor: "error.main",
                  color: "error.main",
                  "&:hover": {
                    borderColor: "error.main",
                    backgroundColor: "rgba(211,47,47,0.04)",
                  },
                }}
                onClick={() => console.log("Delete listing", card.id)}
              >
                Delete listing
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CardDetailDialog;
