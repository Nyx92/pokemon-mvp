"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Box, Typography, IconButton, CircularProgress } from "@mui/material";
import { motion } from "framer-motion";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import { useAuth } from "@/app/hooks/useAuth";
import { useWatchlistAnimation } from "@/app/context/WatchlistAnimationContext";
import { useCart } from "@/app/context/CartContext";
import BuyBox, { type ActiveOffer } from "@/app/shared-components/cards/BuyBox";
import ErrorState from "@/app/shared-components/ErrorState";
import CardMarketChart from "@/app/shared-components/cards/CardMarketChart";
import EditPriceDialog from "@/app/shared-components/cards/EditPriceDialog";
import AllListings from "@/app/shared-components/cards/AllListings";
import PlaceOfferDialog from "@/app/shared-components/cards/PlaceOfferDialog";
import SellerOffersDialog from "@/app/shared-components/cards/SellerOffersDialog";
import AuctionDialog from "./components/AuctionDialog";
import PlaceBidDialog from "./components/PlaceBidDialog";
import type { CardItem } from "@/types/card";
import type { AuctionItem } from "@/types/auction";

const primaryBlue = "#0053ff";

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, isAdmin } = useAuth();
  const { triggerFly, adjustCount } = useWatchlistAnimation();
  const { addToCart } = useCart();
  const watchlistBtnRef = useRef<HTMLButtonElement | null>(null);

  const [card, setCard] = useState<CardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardErrorType, setCardErrorType] = useState<"not_found" | "error" | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [watchlisted, setWatchlisted] = useState(false);
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [editPriceOpen, setEditPriceOpen] = useState(false);
  const [placeOfferOpen, setPlaceOfferOpen] = useState(false);
  const [sellerOffersOpen, setSellerOffersOpen] = useState(false);
  const [offersCount, setOffersCount] = useState(0);
  // The viewer's own offer on this card (pending/accepted/rejected/expired/paid).
  // Shown in the BuyBox as a status callout so the buyer knows what's happening.
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  const [cartStatus, setCartStatus] = useState<"idle" | "adding" | "added" | "already">("idle");
  const [auction,           setAuction]           = useState<AuctionItem | null>(null);
  const [auctionDialogOpen, setAuctionDialogOpen] = useState(false);
  const [bidDialogOpen,     setBidDialogOpen]     = useState(false);
  // Pre-filled bid amount for the Buy Now (buy-out) flow; undefined means no prefill.
  const [bidInitialAmount,  setBidInitialAmount]  = useState<number | undefined>(undefined);

  // Combined card + auction fetch on [id].
  // 1. Fetch card; classify non-ok responses so the user sees the right error.
  // 2. If the card is in an auction, also fetch the auction in the same effect
  //    so BuyBox receives both in one render cycle (no flicker between states).
  // 3. loading=false only after everything above is done.
  //
  // Auction background:
  //   card.inAuction is set to true by POST /api/auctions when the seller starts an auction.
  //   GET /api/auctions?cardId returns any auction with status "active" or
  //   "pending_seller_decision" — the raw DB row regardless of endsAt.
  //   setAuction stores it; liveAuction below applies the client-side filters
  //   (auctionExpiredClientSide) before deciding whether to pass it to BuyBox.
  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      // 1. Reset error state and start loading.
      setCardErrorType(null);
      setLoading(true);
      try {
        // 2. Fetch card.
        const res = await fetch(`/api/cards/${id}`);
        if (!res.ok) {
          // 3. Classify the error so the render branch shows the right message.
          const data = await res.json().catch(() => ({}));
          console.error("Error loading card:", data.error ?? res.status);
          setCardErrorType(res.status === 404 ? "not_found" : "error");
          return;
        }
        const data = await res.json();
        const fetchedCard: CardItem = data.card;
        // 4. Set card state.
        setCard(fetchedCard);
        setWatchlisted(fetchedCard.watchlistedByUser ?? false);
        setWatchlistCount(fetchedCard.watchlistCount ?? 0);
        // 5. If the card is in an auction, fetch it now (same tick → no flicker).
        if (fetchedCard.inAuction === true) {
          const aRes = await fetch(`/api/auctions?cardId=${encodeURIComponent(id)}`);
          const aData = await aRes.json().catch(() => ({}));
          if (aData.auction) setAuction(aData.auction);
        }
      } catch (err) {
        console.error("Failed to fetch card:", err);
        setCardErrorType("error");
      } finally {
        // 6. Always clear loading once all fetches are done.
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  // Fetch the viewer's own offer on this card (non-owners only)
  useEffect(() => {
    if (!id || !userId) return;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}&myOffer=true`)
      .then((r) => r.json())
      .then((data) => { if ("offer" in data) setActiveOffer(data.offer); })
      .catch(() => {});
  }, [id, userId]);

  // Fetch offer count for owner's button label
  useEffect(() => {
    if (!id || !userId) return;
    fetch(`/api/offers?cardId=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((data) => { if (data.offers) setOffersCount(data.offers.length); })
      .catch(() => {});
  }, [id, userId]);

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (cardErrorType === "not_found") {
    return (
      <ErrorState
        variant="not_found"
        title="Card not found"
        subtitle="This card may have been removed or the link is incorrect."
        action={{ label: "Back to Marketplace", href: "/marketplace" }}
      />
    );
  }

  if (cardErrorType === "error") {
    return (
      <ErrorState
        variant="error"
        action={{ label: "Go to Home", href: "/" }}
      />
    );
  }

  if (!card) return null;

  const isOwner = userId === card.owner?.id;
  const canManageListing = isOwner || isAdmin;
  const isForSale = card.forSale && card.status !== "sold";

  // Determine whether to pass the auction to BuyBox (auction mode) or null (standard mode).
  //
  // 1. auctionExpiredClientSide: active auction with no bids whose endsAt has passed.
  //    We treat it as ended immediately on the client so the standard BuyBox appears
  //    without waiting up to 5 min for the cron to flip it to "expired".
  //    Active auctions WITH bids are NOT expired here — BuyBox handles that case
  //    with the pendingSystemUpdate info box (4.3) while waiting for the cron.
  const auctionExpiredClientSide =
    auction?.status === "active" &&
    new Date(auction.endsAt) <= new Date() &&
    (auction.bidCount ?? 0) === 0;

  // 2. liveAuction: non-null only while the auction is genuinely live or awaiting
  //    a seller decision. Passing this to BuyBox switches it into auction mode.
  //    null → BuyBox reverts to standard buy/offer mode.
  const liveAuction =
    auction &&
    ["active", "pending_seller_decision"].includes(auction.status) &&
    !auctionExpiredClientSide
      ? auction
      : null;

  const safeText = (val?: string | null) =>
    val && val.trim().length > 0 ? val : "-";

  const cardNumber = safeText(card.cardNumber);
  const language = safeText(card.language ?? "English");
  const condition = safeText(card.condition);

  const requireLogin = (action: () => void) => {
    if (!userId) {
      router.push(
        `/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }
    action();
  };

  const handleWatchlist = () => {
    requireLogin(async () => {
      const adding = !watchlisted;
      const res = await fetch(`/api/cards/${id}/watchlist`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setWatchlisted(data.watchlisted);
        setWatchlistCount(data.count);
        if (adding && data.watchlisted) {
          const rect = watchlistBtnRef.current?.getBoundingClientRect();
          if (rect) triggerFly(rect, card?.imageUrls?.[0] || "/placeholder.png");
        } else if (!adding && !data.watchlisted) {
          adjustCount(-1);
        }
      }
    });
  };

  const handleBuyNow = async () => {
    if (!card || !card.price || !userId) return;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: card.id,
          title: card.title,
          price: card.price,
          imageUrls: card.imageUrls ?? [],
          buyerId: userId,
        }),
      });
      if (!res.ok) return console.error("Failed to create checkout session");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Error calling /api/checkout:", err);
    }
  };

  const handleAuctionDecide = async (auctionId: string, action: "accept" | "reject") => {
    const res = await fetch(`/api/auctions/${auctionId}/decide`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action }),
    });
    if (res.ok) {
      if (action === "accept") {
        window.location.href = "/sold";
      } else {
        setAuction((a) => a ? { ...a, status: "expired" } : a);
        setCard((c) => c ? { ...c, inAuction: false } : c);
      }
    }
  };

  const handleAddToCart = () => {
    requireLogin(async () => {
      if (!card) return;
      setCartStatus("adding");
      const result = await addToCart(card.id);
      if (result.success) {
        setCartStatus(result.alreadyInCart ? "already" : "added");
      } else {
        setCartStatus("idle");
      }
    });
  };


  return (
    <Box
      sx={{
        maxWidth: 1400,
        mx: "auto",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
      }}
    >
      {/* 1. Back button fades in from the left before the main layout renders. */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Box
          onClick={() => router.push("/")}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            mb: 2,
            cursor: "pointer",
            color: "#6b7280",
            "&:hover": { color: "#111" },
          }}
        >
          <ArrowBackIcon fontSize="small" />
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
            Back to Home
          </Typography>
        </Box>
      </motion.div>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 5,
          alignItems: "flex-start",
        }}
      >
        {/* 2. Three columns enter sequentially: image from left → metadata from
               below (0.1 s) → BuyBox from right (0.15 s). Columns use flex-basis
               so the motion wrapper is the correct flex child width. */}
        {/* ===== COL 1: image ===== */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{ flex: "0 0 360px", maxWidth: "100%" }}
        >
        <Box
          sx={{
            flex: { xs: "0 0 auto", md: "0 0 360px" },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            px: 1,
          }}
        >
          {/* Main image */}
          <Box
            sx={{
              width: "100%",
              backgroundColor: "#f8f8f8",
              borderRadius: 3,
              p: 2,
            }}
          >
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "2/3",
                overflow: "hidden",
                borderRadius: 1.5,
              }}
            >
            <Image
              src={card.imageUrls?.[activeImageIndex] || "/placeholder.png"}
              alt={card.title}
              fill
              sizes="360px"
              style={{ objectFit: "contain" }}
              priority
            />

            {/* Watchlist button — top-right, visible to non-owners */}
            {!isOwner && (
              <Box
                sx={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.2,
                }}
              >
                <IconButton
                  ref={watchlistBtnRef}
                  onClick={handleWatchlist}
                  aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.95)",
                    "&:hover": { backgroundColor: "rgba(255,255,255,1)" },
                    p: 0.8,
                  }}
                >
                  {watchlisted
                    ? <BookmarkIcon sx={{ fontSize: 20, color: "#0053ff" }} />
                    : <BookmarkBorderIcon sx={{ fontSize: 20, color: "#555" }} />
                  }
                </IconButton>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#555" }}>
                  {watchlistCount}
                </Typography>
              </Box>
            )}
            </Box>
          </Box>

          {/* Thumbnails */}
          {card.imageUrls?.length > 1 && (
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {card.imageUrls.map((url, i) => (
                <Box
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 1.5,
                    overflow: "hidden",
                    cursor: "pointer",
                    border:
                      i === activeImageIndex
                        ? `2px solid ${primaryBlue}`
                        : "1px solid #ddd",
                    backgroundColor: "#fff",
                    position: "relative",
                  }}
                >
                  <Image
                    src={url || "/placeholder.png"}
                    alt={`thumb ${i + 1}`}
                    fill
                    sizes="56px"
                    style={{ objectFit: "cover" }}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
        </motion.div>

        {/* ===== COL 2: title + metadata ===== */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
          style={{ flex: 1, minWidth: 0 }}
        >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: 20, sm: 24, md: 28 },
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.4px",
              color: "#111",
            }}
          >
            {card.title}
          </Typography>

          <Box>
            {[
              ["Card No.", cardNumber],
              ["Language", language],
              ["Condition", condition],
              ...(card.setName ? [["Set Name", card.setName]] : []),
              ...(card.rarity ? [["Rarity", card.rarity]] : []),
            ].map(([label, value]) => (
              <Box
                key={label}
                sx={{ display: "flex", py: 0.5, alignItems: "baseline" }}
              >
                <Typography
                  sx={{
                    width: 120,
                    fontSize: 13,
                    color: "#6b7280",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </Typography>
                <Typography
                  sx={{ fontSize: 13, fontWeight: 700, color: "#111" }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
        </motion.div>

        {/* ===== COL 3: buybox + market chart ===== */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
          style={{ flex: "0 0 500px", maxWidth: "100%" }}
        >
        <Box
          sx={{
            flex: { xs: "0 0 auto", md: "0 0 500px" },
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* BuyBox handles both standard and auction modes.
              When liveAuction is provided the price/action section switches to
              auction UI; the conditions (grade pills) section is always shown. */}
          <BuyBox
            tcgPlayerId={card.tcgPlayerId}
            currentCardId={card.id}
            currentCondition={card.condition}
            currentPrice={card.price}
            mode={canManageListing ? "owner" : "viewer"}
            offersCount={offersCount}
            activeOffer={activeOffer}
            onEdit={() => {
              if (isAdmin) router.push(`/cards/${card.id}/edit`);
              else setEditPriceOpen(true);
            }}
            onViewListings={() =>
              document
                .getElementById("all-listings")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            isForSale={isForSale}
            priceText={
              card.price != null ? `S$${card.price.toFixed(2)}` : "S$ -"
            }
            primaryBlue={primaryBlue}
            onPlaceOffer={() =>
              requireLogin(() => {
                if (canManageListing) setSellerOffersOpen(true);
                else setPlaceOfferOpen(true);
              })
            }
            onBuyNow={() => requireLogin(handleBuyNow)}
            onAddToCart={!canManageListing ? handleAddToCart : undefined}
            cartStatus={cartStatus}
            // "Start Auction" only offered when no live auction is running and the
            // previous (zero-bid) auction has already been cleared by the cron.
            // While auctionExpiredClientSide is true the cron hasn't run yet —
            // BuyBox shows a "processing" banner instead via auctionPendingCleanup.
            onStartAuction={isOwner && !isAdmin && !liveAuction && !auctionExpiredClientSide ? () => setAuctionDialogOpen(true) : undefined}
            auctionPendingCleanup={auctionExpiredClientSide}
            // Auction mode — null when auction has ended or doesn't exist
            auction={liveAuction}
            onPlaceBid={!isOwner ? () => requireLogin(() => {
              setBidInitialAmount(undefined);
              setBidDialogOpen(true);
            }) : undefined}
            onBuyOut={!isOwner ? () => requireLogin(() => {
              setBidInitialAmount(liveAuction?.buyOutPrice ?? undefined);
              setBidDialogOpen(true);
            }) : undefined}
            onAuctionDecide={isOwner && liveAuction ? (action) => handleAuctionDecide(liveAuction.id, action) : undefined}
          />

          <CardMarketChart card={card} />
        </Box>
        </motion.div>
      </Box>

      {/* All Listings */}
      <Box id="all-listings" sx={{ mt: 4 }}>
        <AllListings tcgPlayerId={card.tcgPlayerId} currentCardId={card.id} />
      </Box>

      {!isAdmin && isOwner && (
        <EditPriceDialog
          open={editPriceOpen}
          cardId={card.id}
          currentPrice={card.price}
          currentForSale={card.forSale}
          onClose={() => setEditPriceOpen(false)}
          onSuccess={(updatedPrice, updatedForSale) => {
            setCard((prev) =>
              prev
                ? { ...prev, price: updatedPrice, forSale: updatedForSale }
                : prev
            );
          }}
        />
      )}

      {/* Buyer: place / amend an offer */}
      {!canManageListing && (
        <PlaceOfferDialog
          open={placeOfferOpen}
          cardId={card.id}
          cardTitle={card.title}
          listingPrice={card.price}
          existingOffer={
            activeOffer?.status === "pending"
              ? { id: activeOffer.id, price: activeOffer.price, message: activeOffer.message }
              : null
          }
          onClose={() => setPlaceOfferOpen(false)}
          onSuccess={() => {
            setPlaceOfferOpen(false);
            // Re-fetch the viewer's offer to update the BuyBox callout
            fetch(`/api/offers?cardId=${encodeURIComponent(card.id)}&myOffer=true`)
              .then((r) => r.json())
              .then((data) => { if ("offer" in data) setActiveOffer(data.offer); })
              .catch(() => {});
          }}
        />
      )}

      {/* Seller: view and act on offers */}
      {canManageListing && (
        <SellerOffersDialog
          open={sellerOffersOpen}
          cardId={card.id}
          cardTitle={card.title}
          onClose={() => {
            setSellerOffersOpen(false);
            fetch(`/api/offers?cardId=${encodeURIComponent(card.id)}`)
              .then((r) => r.json())
              .then((data) => { if (data.offers) setOffersCount(data.offers.length); })
              .catch(() => {});
          }}
          onAccepted={() => {
            setSellerOffersOpen(false);
            window.location.href = "/sold";
          }}
        />
      )}

      {/* Owner: start an auction (hidden while a live auction is running) */}
      {isOwner && !liveAuction && (
        <AuctionDialog
          open={auctionDialogOpen}
          cardId={card.id}
          cardTitle={card.title}
          onClose={() => setAuctionDialogOpen(false)}
          onSuccess={() => {
            setAuctionDialogOpen(false);
            // Re-fetch card so inAuction flag and auction data update
            fetch(`/api/cards/${id}`)
              .then((r) => r.json())
              .then((data) => { if (data.card) setCard(data.card); })
              .catch(() => {});
            fetch(`/api/auctions?cardId=${encodeURIComponent(id)}`)
              .then((r) => r.json())
              .then((data) => { if (data.auction) setAuction(data.auction); })
              .catch(() => {});
          }}
        />
      )}

      {/* Buyer: place a bid (only rendered while auction is live) */}
      {!isOwner && liveAuction && (
        <PlaceBidDialog
          open={bidDialogOpen}
          auction={liveAuction}
          initialAmount={bidInitialAmount}
          onClose={() => {
            setBidDialogOpen(false);
            setBidInitialAmount(undefined);
          }}
          onSuccess={(settled) => {
            setBidDialogOpen(false);
            setBidInitialAmount(undefined);
            if (settled) {
              // Buyout: auction is closed — clear state immediately so BuyBox
              // reverts to standard mode without waiting for a re-fetch.
              setAuction(null);
              setCard((c) => c ? { ...c, inAuction: false } : c);
            } else {
              // Normal bid: re-fetch auction to reflect updated bid count and amount.
              // Use ?? null so a sold/expired auction correctly clears the state.
              fetch(`/api/auctions?cardId=${encodeURIComponent(id)}`)
                .then((r) => r.json())
                .then((data) => { setAuction(data.auction ?? null); })
                .catch(() => {});
            }
          }}
        />
      )}
    </Box>
  );
}

