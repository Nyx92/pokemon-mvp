"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  Box,
  Typography,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  Divider,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ReplayIcon from "@mui/icons-material/Replay";
import RateReviewIcon from "@mui/icons-material/RateReview";

type OrderStatus =
  | "Delivered"
  | "Processing"
  | "Unpaid"
  | "Refunded"
  | "Returns & Canceled";

type OrderItem = {
  id: string;
  title: string;
  priceText: string;
  imageUrl: string;
  sellerName: string;
  sellerHref?: string;
  listingHref?: string;
  subtitle?: string; // e.g. "Returns not accepted."
};

type Order = {
  id: string;
  statusLabelTop: string; // e.g. "Return escalated"
  orderDate: string; // "Dec 13, 2023"
  orderTotal: string; // "S$60.00"
  orderNumber: string; // "26-10914-44527"
  status: OrderStatus;
  items: OrderItem[];
};

const primaryBlue = "#1976d2"; // toned-down MUI-ish blue

const FILTERS: { key: OrderStatus | "All"; label: string }[] = [
  { key: "All", label: "All Purchases" },
  { key: "Processing", label: "Processing" },
  { key: "Unpaid", label: "Unpaid items" },
  { key: "Returns & Canceled", label: "Returns & Canceled" },
  { key: "Delivered", label: "Delivered" },
  { key: "Refunded", label: "Refunded" },
];

const SEE_ORDERS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "30d", label: "Last 30 days" },
  { value: "2026", label: "2026" },
  { value: "2025", label: "2025" },
  { value: "2024", label: "2024" },
];

function getQueryParam(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function PurchasesPage() {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | "All">("All");
  const [seeOrders, setSeeOrders] = useState("all");
  const [q, setQ] = useState("");

  // Success banner if you redirect here after checkout
  const [showSuccess, setShowSuccess] = useState(
    () => getQueryParam("success") === "1"
  );
  const highlightedOrder = useMemo(() => getQueryParam("order") || "", []);

  // Hardcoded seed data (swap to DB later)
  const orders: Order[] = useMemo(
    () => [
      {
        id: "ord_01",
        statusLabelTop: "Return escalated",
        orderDate: "Dec 13, 2023",
        orderTotal: "S$1,528.05",
        orderNumber: "26-10914-44527",
        status: "Delivered",
        items: [
          {
            id: "itm_01",
            title: "PSA 10 GEM MINT Lisia 164 - Caitlin 189 - 4x Marnie 200",
            priceText: "S$1,528.05",
            imageUrl: "/placeholder.png",
            sellerName: "card_palace_collectibles",
            sellerHref: "#",
            listingHref: "#",
            subtitle: "Returns not accepted.",
          },
        ],
      },
      {
        id: "ord_02",
        statusLabelTop: "Refunded",
        orderDate: "Sep 13, 2023",
        orderTotal: "S$0.00",
        orderNumber: "06-10539-15976",
        status: "Refunded",
        items: [
          {
            id: "itm_02",
            title: "Starmie GX - Mint",
            priceText: "S$60.00",
            imageUrl: "/placeholder.png",
            sellerName: "ocean_cards_sg",
            sellerHref: "#",
            listingHref: "#",
            subtitle: "Refunded — payment reversed.",
          },
        ],
      },
      {
        id: "ord_03",
        statusLabelTop: "Payment pending",
        orderDate: "Jan 16, 2026",
        orderTotal: "S$95.00",
        orderNumber: "POK-20260116-0003",
        status: "Processing",
        items: [
          {
            id: "itm_03",
            title: "Gyarados VMAX - Near Mint",
            priceText: "S$95.00",
            imageUrl: "/placeholder.png",
            sellerName: "singapore_slabs",
            sellerHref: "#",
            listingHref: "#",
            subtitle: "Processing — awaiting confirmation.",
          },
        ],
      },
      {
        id: "ord_04",
        statusLabelTop: "Checkout cancelled",
        orderDate: "Jan 12, 2026",
        orderTotal: "S$0.00",
        orderNumber: "POK-20260112-0004",
        status: "Returns & Canceled",
        items: [
          {
            id: "itm_04",
            title: "Charizard ex - (sample listing)",
            priceText: "S$0.00",
            imageUrl: "/placeholder.png",
            sellerName: "demo_seller",
            sellerHref: "#",
            listingHref: "#",
            subtitle: "Cancelled — you were not charged.",
          },
        ],
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const byFilter =
      activeFilter === "All"
        ? orders
        : orders.filter((o) => o.status === activeFilter);

    const bySearch = q.trim().length
      ? byFilter.filter((o) => {
          const hay = [
            o.orderNumber,
            o.orderDate,
            o.orderTotal,
            o.status,
            o.statusLabelTop,
            ...o.items.map((i) => `${i.title} ${i.sellerName}`),
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q.trim().toLowerCase());
        })
      : byFilter;

    // "See orders" is just a visual filter placeholder for now
    if (seeOrders === "30d") return bySearch.slice(0, 2);
    return bySearch;
  }, [orders, activeFilter, q, seeOrders]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        backgroundColor: "#ffffff",
        px: { xs: 2, md: 4 },
        py: { xs: 2, md: 3 },
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 2.5,
        }}
      >
        <Typography sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 800 }}>
          Purchases
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 1.2,
            alignItems: "center",
            justifyContent: { xs: "stretch", md: "flex-end" },
            flexWrap: "wrap",
          }}
        >
          <TextField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your orders"
            size="small"
            sx={{
              width: { xs: "100%", md: 520 },
              backgroundColor: "#fff",
              borderRadius: 2,
              "& .MuiOutlinedInput-root": { borderRadius: 2 },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#6b7280" }} />
                </InputAdornment>
              ),
              endAdornment: q ? (
                <InputAdornment position="end">
                  <IconButton onClick={() => setQ("")} size="small">
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Button
            variant="contained"
            sx={{
              backgroundColor: primaryBlue,
              "&:hover": { backgroundColor: "#1565c0" },
              borderRadius: 999,
              px: 3,
              py: 1,
              textTransform: "none",
              fontWeight: 800,
              height: 40,
            }}
            onClick={() => {
              // search already live; button is UX affordance
            }}
          >
            Search
          </Button>
        </Box>
      </Box>

      {/* Success banner */}
      {showSuccess && (
        <Box
          sx={{
            mb: 2,
            border: "1px solid rgba(25,118,210,0.25)",
            backgroundColor: "rgba(25,118,210,0.08)",
            borderRadius: 2,
            px: 2,
            py: 1.2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", gap: 1.2, alignItems: "center" }}>
            <ShoppingBagIcon sx={{ color: primaryBlue }} />
            <Box>
              <Typography sx={{ fontWeight: 800 }}>
                Purchase successful
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#4b5563" }}>
                Your order has been added to your purchase history.
                {highlightedOrder ? ` (Order: ${highlightedOrder})` : ""}
              </Typography>
            </Box>
          </Box>

          <Button
            variant="text"
            sx={{ textTransform: "none", fontWeight: 800 }}
            onClick={() => setShowSuccess(false)}
          >
            Dismiss
          </Button>
        </Box>
      )}

      {/* Filter chips row */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        {FILTERS.map((f) => {
          const selected = activeFilter === f.key;
          return (
            <Chip
              key={f.key}
              label={f.label}
              clickable
              onClick={() => setActiveFilter(f.key)}
              sx={{
                borderRadius: 999,
                fontWeight: 700,
                px: 0.8,
                backgroundColor: selected ? "rgba(0,0,0,0.06)" : "#f3f4f6",
                border: selected ? "1px solid #111" : "1px solid transparent",
              }}
            />
          );
        })}
      </Box>

      {/* Orders header row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>Orders</Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ color: "#111", fontSize: 14 }}>
            See orders:
          </Typography>

          <FormControl size="small">
            <Select
              value={seeOrders}
              onChange={(e) => setSeeOrders(String(e.target.value))}
              sx={{ borderRadius: 2, minWidth: 140 }}
            >
              {SEE_ORDERS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Orders list */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            primaryBlue={primaryBlue}
            highlighted={highlightedOrder === order.orderNumber}
          />
        ))}

        {filtered.length === 0 && (
          <Box
            sx={{
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              p: 2,
              color: "#6b7280",
            }}
          >
            No orders match your filters.
          </Box>
        )}
      </Box>
    </Box>
  );
}

function OrderCard({
  order,
  primaryBlue,
  highlighted,
}: {
  order: Order;
  primaryBlue: string;
  highlighted?: boolean;
}) {
  const item = order.items[0];

  return (
    <Box
      sx={{
        border: highlighted ? `2px solid ${primaryBlue}` : "1px solid #e5e7eb",
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {/* Top summary bar */}
      <Box
        sx={{
          backgroundColor: "#f9fafb",
          px: 2,
          py: 1.3,
          display: "flex",
          alignItems: { xs: "stretch", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
            {order.statusLabelTop}
          </Typography>
          <Typography sx={{ color: "#4b5563", fontSize: 13, mt: 0.3 }}>
            Order date: {order.orderDate} • Order total: {order.orderTotal} •
            Order number: {order.orderNumber}
          </Typography>
        </Box>

        <Button
          variant="outlined"
          sx={{
            borderRadius: 999,
            textTransform: "none",
            fontWeight: 800,
            px: 2.2,
            alignSelf: { xs: "flex-start", md: "auto" },
            borderColor: primaryBlue,
            color: primaryBlue,
            "&:hover": {
              borderColor: primaryBlue,
              backgroundColor: "rgba(25,118,210,0.06)",
            },
          }}
          onClick={() => console.log("view order details", order.orderNumber)}
        >
          View order details
        </Button>
      </Box>

      <Divider />

      {/* Item row */}
      <Box
        sx={{
          px: 2,
          py: 2,
          display: "grid",
          gridTemplateColumns: { xs: "84px 1fr", md: "130px 1fr 280px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Image */}
        <Box
          sx={{
            width: { xs: 84, md: 130 },
            height: { xs: 84, md: 130 },
            borderRadius: 2,
            overflow: "hidden",
            backgroundColor: "#f3f4f6",
            position: "relative",
            border: "1px solid #e5e7eb",
          }}
        >
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            style={{ objectFit: "cover" }}
          />
        </Box>

        {/* Details */}
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <StatusPill status={order.status} primaryBlue={primaryBlue} />

            {order.status === "Delivered" && (
              <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
                Delivered on {order.orderDate}
              </Typography>
            )}
            {order.status !== "Delivered" && (
              <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
                {order.status}
              </Typography>
            )}
          </Box>

          {item.subtitle && (
            <Typography sx={{ color: "#6b7280", fontSize: 13, mt: 0.4 }}>
              {item.subtitle}
            </Typography>
          )}

          <Box sx={{ mt: 1 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: 15,
                textDecoration: "underline",
                textDecorationColor: "rgba(0,0,0,0.25)",
                cursor: "pointer",
                display: "inline",
              }}
              onClick={() => console.log("open listing", item.listingHref)}
            >
              {item.title}
            </Typography>

            <Typography sx={{ mt: 0.6, fontWeight: 800 }}>
              {item.priceText}
            </Typography>

            <Typography sx={{ mt: 0.6, color: "#6b7280", fontSize: 13 }}>
              Sold by:{" "}
              <Link
                href={item.sellerHref ?? "#"}
                style={{ color: primaryBlue }}
              >
                {item.sellerName}
              </Link>
            </Typography>
          </Box>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            alignItems: { xs: "stretch", md: "flex-end" },
            gridColumn: { xs: "1 / -1", md: "auto" },
          }}
        >
          <Button
            variant="contained"
            startIcon={<OpenInNewIcon />}
            sx={{
              backgroundColor: primaryBlue,
              "&:hover": { backgroundColor: "#1565c0" },
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              px: 2.2,
            }}
            onClick={() => console.log("view similar", order.orderNumber)}
          >
            View similar items
          </Button>

          <Button
            variant="outlined"
            startIcon={<LocalShippingIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              px: 2.2,
              borderColor: primaryBlue,
              color: primaryBlue,
              "&:hover": {
                borderColor: primaryBlue,
                backgroundColor: "rgba(25,118,210,0.06)",
              },
            }}
            onClick={() => console.log("seller other items", item.sellerName)}
          >
            View seller&apos;s other items
          </Button>

          <Button
            variant="outlined"
            startIcon={<RateReviewIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              px: 2.2,
              borderColor: "#e5e7eb",
              color: "#111",
              "&:hover": { borderColor: "#d1d5db", backgroundColor: "#fff" },
            }}
            onClick={() => console.log("leave feedback", order.orderNumber)}
          >
            Ready for feedback
          </Button>

          <Button
            variant="text"
            startIcon={<MoreHorizIcon />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontWeight: 800,
              px: 1.2,
              alignSelf: { xs: "flex-start", md: "flex-end" },
              color: "#111",
            }}
            onClick={() => console.log("more actions", order.orderNumber)}
          >
            More actions
          </Button>

          {/* Example: show resell button for delivered/refunded */}
          {(order.status === "Delivered" || order.status === "Refunded") && (
            <Button
              variant="outlined"
              startIcon={<ReplayIcon />}
              sx={{
                borderRadius: 999,
                textTransform: "none",
                fontWeight: 800,
                px: 2.2,
                borderColor: "#e5e7eb",
                color: "#111",
                "&:hover": { borderColor: "#d1d5db", backgroundColor: "#fff" },
              }}
              onClick={() => console.log("resell", item.id)}
            >
              Resell
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function StatusPill({
  status,
  primaryBlue,
}: {
  status: OrderStatus;
  primaryBlue: string;
}) {
  const meta = (() => {
    switch (status) {
      case "Delivered":
        return {
          label: "Delivered",
          bg: "rgba(16,185,129,0.12)",
          fg: "#065f46",
        };
      case "Processing":
        return {
          label: "Processing",
          bg: "rgba(25,118,210,0.12)",
          fg: primaryBlue,
        };
      case "Unpaid":
        return { label: "Unpaid", bg: "rgba(245,158,11,0.14)", fg: "#92400e" };
      case "Refunded":
        return {
          label: "Refunded",
          bg: "rgba(107,114,128,0.14)",
          fg: "#374151",
        };
      case "Returns & Canceled":
        return {
          label: "Returns & Canceled",
          bg: "rgba(239,68,68,0.12)",
          fg: "#991b1b",
        };
      default:
        return { label: status, bg: "rgba(107,114,128,0.14)", fg: "#374151" };
    }
  })();

  return (
    <Box
      sx={{
        px: 1,
        py: 0.35,
        borderRadius: 999,
        backgroundColor: meta.bg,
        color: meta.fg,
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {meta.label}
    </Box>
  );
}
