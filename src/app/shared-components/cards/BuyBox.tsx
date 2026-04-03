"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Divider, Alert } from "@mui/material";
import { useRouter } from "next/navigation";
import GavelIcon from "@mui/icons-material/Gavel";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PendingIcon from "@mui/icons-material/Pending";
import {
  RAW_GRADES,
  PSA_GRADES,
  BECKETT_GRADES,
  CGC_GRADES,
  SGC_GRADES,
} from "@/constants/grades";
import type { CardItem } from "@/types/card";

type GradeCompany = "Raw" | "PSA" | "Beckett" | "CGC" | "SGC";
const GRADE_COMPANIES: GradeCompany[] = ["Raw", "PSA", "Beckett", "CGC", "SGC"];

function getCompany(condition: string): GradeCompany {
  if ((PSA_GRADES as readonly string[]).includes(condition)) return "PSA";
  if ((BECKETT_GRADES as readonly string[]).includes(condition)) return "Beckett";
  if ((CGC_GRADES as readonly string[]).includes(condition)) return "CGC";
  if ((SGC_GRADES as readonly string[]).includes(condition)) return "SGC";
  return "Raw";
}

function getGradesForCompany(company: GradeCompany): string[] {
  switch (company) {
    case "PSA":     return [...PSA_GRADES];
    case "Beckett": return [...BECKETT_GRADES];
    case "CGC":     return [...CGC_GRADES];
    case "SGC":     return [...SGC_GRADES];
    default:        return [...RAW_GRADES];
  }
}

type ListingSummary = { id: string; condition: string; price: number | null };

export interface ActiveOffer {
  id: string;
  price: number;
  status: "pending" | "accepted" | "rejected" | "expired" | "paid" | string;
  acceptedUntil: string | null;
  message: string | null;
}

interface BuyBoxProps {
  tcgPlayerId: string;
  currentCardId: string;
  currentCondition: string;
  currentPrice: number | null;

  isForSale: boolean;
  priceText: string;
  primaryBlue: string;

  onPlaceOffer: () => void;
  onBuyNow: () => void;
  onPayOffer?: () => void; // called when buyer pays their accepted offer

  mode?: "viewer" | "owner";
  offersCount?: number;
  onEdit?: () => void;
  onViewListings?: () => void;

  // Viewer's own offer on this card (if any)
  activeOffer?: ActiveOffer | null;
  // Card is locked for another buyer's accepted offer
  cardHasPendingOffer?: boolean;
}

export default function BuyBox({
  tcgPlayerId,
  currentCardId,
  currentCondition,
  currentPrice,
  isForSale,
  priceText,
  primaryBlue,
  onPlaceOffer,
  onBuyNow,
  onPayOffer,
  mode = "viewer",
  offersCount = 0,
  onEdit,
  onViewListings,
  activeOffer = null,
  cardHasPendingOffer = false,
}: BuyBoxProps) {
  const router = useRouter();
  const isOwnerMode = mode === "owner";

  const [listings, setListings] = useState<ListingSummary[]>([]);
  const currentCompany = getCompany(currentCondition);
  const [selectedCompany, setSelectedCompany] = useState<GradeCompany>(currentCompany);

  useEffect(() => {
    if (!tcgPlayerId) return;
    fetch(`/api/cards?tcgPlayerId=${encodeURIComponent(tcgPlayerId)}&forSale=true`)
      .then((r) => r.json())
      .then((data) => {
        if (data.cards) {
          setListings(
            data.cards.map((c: CardItem) => ({
              id: c.id,
              condition: c.condition,
              price: c.price,
            }))
          );
        }
      })
      .catch(console.error);
  }, [tcgPlayerId]);

  // Cheapest listing per condition
  const cheapestByCondition = new Map<string, ListingSummary>();
  for (const l of listings) {
    const existing = cheapestByCondition.get(l.condition);
    if (
      !existing ||
      (l.price !== null && (existing.price === null || l.price < existing.price))
    ) {
      cheapestByCondition.set(l.condition, l);
    }
  }

  // Same-condition listings excluding the current card
  const sameConditionOthers = listings.filter(
    (l) => l.condition === currentCondition && l.id !== currentCardId
  );
  const otherCount = sameConditionOthers.length;
  const lowestOther = sameConditionOthers.reduce<number | null>((min, l) => {
    if (l.price === null) return min;
    return min === null ? l.price : Math.min(min, l.price);
  }, null);

  // Is the current card the cheapest for its condition?
  const lowestForCondition = listings
    .filter((l) => l.condition === currentCondition)
    .reduce<number | null>((min, l) => {
      if (l.price === null) return min;
      return min === null ? l.price : Math.min(min, l.price);
    }, null);
  const isLowest =
    currentPrice !== null &&
    lowestForCondition !== null &&
    currentPrice <= lowestForCondition;

  // Companies that have at least one listing
  const companiesWithListings = new Set(listings.map((l) => getCompany(l.condition)));

  // Condition pill renderer (shared for raw and graded)
  const renderPill = (grade: string, listing: ListingSummary | undefined, isCurrent: boolean) => {
    const isCurrentCard = listing?.id === currentCardId;
    const hasListing = !!listing;
    const clickable = hasListing && !isCurrentCard;

    // Strip company prefix for graded display (show just "10", "9.5 Gem Mint", etc.)
    const prefixes = ["PSA ", "Beckett ", "CGC ", "SGC "];
    const displayLabel = prefixes.reduce((label, p) => label.startsWith(p) ? label.slice(p.length) : label, grade);

    return (
      <Box
        key={grade}
        onClick={() => { if (clickable) router.push(`/cards/${listing!.id}`); }}
        sx={{
          px: 1.2,
          py: 0.7,
          borderRadius: 1.5,
          border: isCurrent ? `2px solid ${primaryBlue}` : "1px solid #e5e7eb",
          backgroundColor: isCurrent ? "#eff4ff" : hasListing ? "#fff" : "#f9fafb",
          cursor: clickable ? "pointer" : "default",
          transition: "all 0.12s",
          minWidth: selectedCompany === "Raw" ? 76 : 56,
          textAlign: "center",
          "&:hover": clickable ? { borderColor: primaryBlue, backgroundColor: "#f5f8ff" } : {},
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            color: isCurrent ? primaryBlue : hasListing ? "#374151" : "#d1d5db",
            whiteSpace: "nowrap",
          }}
        >
          {displayLabel}
        </Typography>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 700,
            mt: 0.15,
            color: isCurrent ? primaryBlue : hasListing ? "#111" : "#d1d5db",
          }}
        >
          {listing?.price != null ? `S$${listing.price.toFixed(2)}` : "—"}
        </Typography>
      </Box>
    );
  };

  // ── Derived viewer offer state ─────────────────────────────────────────────
  const offerIsPending  = activeOffer?.status === "pending";
  const offerIsAccepted = activeOffer?.status === "accepted";
  const offerIsRejected = activeOffer?.status === "rejected";
  const offerIsExpired  = activeOffer?.status === "expired";

  // Time-remaining string for accepted offer countdown
  const acceptedUntilMs = activeOffer?.acceptedUntil
    ? new Date(activeOffer.acceptedUntil).getTime() - Date.now()
    : null;
  const hoursLeft = acceptedUntilMs != null
    ? Math.max(0, Math.floor(acceptedUntilMs / 3_600_000))
    : null;

  // Price label
  const priceLabel = isOwnerMode
    ? "Listed for"
    : offerIsAccepted
    ? "Your accepted offer"
    : "Buy Now for";

  // Price text override when offer is accepted
  const displayPriceText = offerIsAccepted && activeOffer?.price != null
    ? `S$${activeOffer.price.toFixed(2)}`
    : priceText;

  // Left button
  const leftBtnLabel = isOwnerMode ? `See Offers (${offersCount})` : "Place Offer";
  const leftBtnDisabled = isOwnerMode
    ? false
    : !isForSale || offerIsAccepted; // can't amend while accepted

  // Right button — transforms to "Pay Now" when offer is accepted
  const rightBtnIsPayOffer = !isOwnerMode && offerIsAccepted;
  const rightBtnLabel = isOwnerMode
    ? "Edit"
    : rightBtnIsPayOffer
    ? `Pay S$${activeOffer!.price!.toFixed(2)}`
    : "Buy Now";
  const rightBtnDisabled = isOwnerMode
    ? false
    : rightBtnIsPayOffer
    ? false
    : (!isForSale || cardHasPendingOffer);

  return (
    <Box
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: 2,
        backgroundColor: "#fff",
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>

        {/* ── CONDITION / GRADE SECTION ── */}
        <Box sx={{ mb: 1.5 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              color: "#6b7280",
              mb: 1,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Condition
          </Typography>

          {/* Company tabs — always visible */}
          <Box sx={{ display: "flex", gap: 0.8, mb: 1.2, flexWrap: "wrap" }}>
            {GRADE_COMPANIES.map((company) => {
              const hasData =
                companiesWithListings.has(company) || company === currentCompany;
              const isSelected = company === selectedCompany;
              return (
                <Box
                  key={company}
                  onClick={() => setSelectedCompany(company)}
                  sx={{
                    px: 1.2,
                    py: 0.4,
                    borderRadius: 1,
                    border: isSelected
                      ? `1.5px solid ${primaryBlue}`
                      : "1px solid #e5e7eb",
                    backgroundColor: isSelected ? "#eff4ff" : "#fff",
                    cursor: "pointer",
                    "&:hover": !isSelected ? { borderColor: "#9ca3af" } : {},
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? primaryBlue : hasData ? "#374151" : "#9ca3af",
                    }}
                  >
                    {company}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Grade/condition pills for selected company */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
            {getGradesForCompany(selectedCompany).map((grade) =>
              renderPill(
                grade,
                cheapestByCondition.get(grade),
                grade === currentCondition
              )
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: "#9ca3af", mt: 0.8 }}>
            Lowest listed price per condition
          </Typography>
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* ── VIEWER OFFER STATUS CALLOUT ── */}
        {!isOwnerMode && activeOffer && (
          <Box sx={{ mb: 1.2 }}>
            {offerIsAccepted && (
              <Alert
                icon={<CheckCircleOutlineIcon fontSize="small" />}
                severity="success"
                sx={{ py: 0.5, fontSize: 12 }}
              >
                Your offer of <strong>S${activeOffer.price!.toFixed(2)}</strong> was accepted!
                {hoursLeft !== null && hoursLeft > 0 && (
                  <> You have <strong>{hoursLeft}h</strong> to pay.</>
                )}
                {hoursLeft === 0 && <> Payment window closing soon.</>}
              </Alert>
            )}
            {offerIsPending && (
              <Alert
                icon={<AccessTimeIcon fontSize="small" />}
                severity="info"
                sx={{ py: 0.5, fontSize: 12 }}
              >
                Your offer of <strong>S${activeOffer.price!.toFixed(2)}</strong> is pending.
              </Alert>
            )}
            {offerIsRejected && (
              <Alert severity="error" sx={{ py: 0.5, fontSize: 12 }}>
                Your offer of <strong>S${activeOffer.price!.toFixed(2)}</strong> was declined.
              </Alert>
            )}
            {offerIsExpired && (
              <Alert severity="warning" sx={{ py: 0.5, fontSize: 12 }}>
                Your accepted offer expired before payment.
              </Alert>
            )}
          </Box>
        )}

        {/* Card locked for another buyer's accepted offer */}
        {!isOwnerMode && cardHasPendingOffer && !activeOffer && (
          <Alert
            icon={<PendingIcon fontSize="small" />}
            severity="warning"
            sx={{ mb: 1.2, py: 0.5, fontSize: 12 }}
          >
            An offer has been accepted — this card is pending purchase.
          </Alert>
        )}

        {/* ── PRICE ROW ── */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            mb: 1.2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 11, color: "#6b7280" }}>{priceLabel}</Typography>
            <Typography
              sx={{
                fontSize: { xs: 22, sm: 26 },
                fontWeight: 700,
                lineHeight: 1.05,
                color: offerIsAccepted ? "#16a34a" : "#111",
                mt: 0.3,
              }}
            >
              {displayPriceText}
            </Typography>
            {offerIsAccepted && (
              <Typography sx={{ fontSize: 11, color: "#6b7280", textDecoration: "line-through" }}>
                Listed: {priceText}
              </Typography>
            )}
          </Box>

          {isLowest && !isOwnerMode && !offerIsAccepted && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.4,
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 1,
                px: 1,
                py: 0.4,
                mb: 0.5,
              }}
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: "#16a34a" }} />
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#16a34a" }}>
                Lowest price
              </Typography>
            </Box>
          )}
        </Box>

        {/* ── ACTION BUTTONS ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, mb: 1.2 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GavelIcon />}
            onClick={onPlaceOffer}
            disabled={leftBtnDisabled}
            sx={{
              textTransform: "none",
              borderColor: "#e5e7eb",
              color: "#111",
              backgroundColor: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              "&:hover": { borderColor: "#d1d5db", backgroundColor: "#fafafa" },
              fontWeight: 500,
              borderRadius: 1.5,
            }}
          >
            {offerIsPending && !isOwnerMode ? "Amend Offer" : leftBtnLabel}
          </Button>

          <Button
            fullWidth
            variant="contained"
            startIcon={
              isOwnerMode ? <EditIcon /> :
              rightBtnIsPayOffer ? <CheckCircleOutlineIcon /> :
              <ShoppingCartIcon />
            }
            onClick={isOwnerMode ? onEdit : rightBtnIsPayOffer ? onPayOffer : onBuyNow}
            disabled={rightBtnDisabled}
            sx={{
              textTransform: "none",
              backgroundColor: rightBtnIsPayOffer ? "#16a34a" : primaryBlue,
              "&:hover": { backgroundColor: rightBtnIsPayOffer ? "#15803d" : "#0041cc" },
              boxShadow: rightBtnIsPayOffer
                ? "0 3px 10px rgba(22,163,74,0.3)"
                : "0 3px 10px rgba(0,83,255,0.25)",
              fontWeight: 500,
              letterSpacing: "0.3px",
              borderRadius: 1.5,
            }}
          >
            {rightBtnLabel}
          </Button>
        </Box>

        {/* ── OTHER LISTINGS (same condition) — always visible ── */}
        {!isOwnerMode && (
          <Box
            onClick={otherCount > 0 ? onViewListings : undefined}
            sx={{
              border: "1px solid #e5e7eb",
              borderRadius: 1.5,
              px: 1.6,
              py: 0.8,
              textAlign: "center",
              backgroundColor: otherCount > 0 ? "#fafafa" : "#f9fafb",
              cursor: otherCount > 0 ? "pointer" : "default",
              "&:hover": otherCount > 0 ? { backgroundColor: "#f3f4f6" } : {},
            }}
          >
            {otherCount > 0 ? (
              <>
                <Typography sx={{ fontSize: 12, color: primaryBlue, fontWeight: 500 }}>
                  {otherCount} other {currentCondition} listing
                  {otherCount !== 1 ? "s" : ""}
                </Typography>
                {lowestOther !== null && (
                  <Typography sx={{ fontSize: 11, color: "#6b7280", mt: 0.15 }}>
                    As low as S${lowestOther.toFixed(2)}
                  </Typography>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>
                Only listing for this condition
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
