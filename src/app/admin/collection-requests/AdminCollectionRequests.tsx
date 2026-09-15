"use client";
/**
 * AdminCollectionRequests — staff view of in-person pickup requests, split
 * into an Open tab (REQUESTED/PACKED) and a Completed tab (COLLECTED).
 * On the Open tab, staff mark a request "Packed" once they've physically
 * pulled and bagged the cards; the customer is then notified in-app and can
 * request their own pickup verification code. On the Completed tab, staff
 * can attribute a handover to themselves after the fact, for requests that
 * were collected without a staff member recording who handled them.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Container, Typography, Box, Card, CardContent, Chip, Button,
  CircularProgress, Alert, Divider, Tabs, Tab,
} from "@mui/material";

interface AdminCard {
  id: string;
  title: string;
  condition: string;
}

interface AdminCollectionRequest {
  id: string;
  requestRef: string;
  status: "REQUESTED" | "PACKED" | "COLLECTED";
  requestedAt: string;
  packedAt: string | null;
  collectedAt: string | null;
  collectedByStaff: { id: string; username: string | null } | null;
  customer: { username: string | null; firstName: string | null; email: string };
  cards: AdminCard[];
}

export default function AdminCollectionRequests() {
  const [requests, setRequests] = useState<AdminCollectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packingId, setPackingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "completed">("open");
  const [attributingId, setAttributingId] = useState<string | null>(null);

  // Mirrors `tab` so an in-flight load() can tell, once its response arrives,
  // whether the user has since switched tabs — a slower Open fetch that wins
  // the race after the user has already flipped to Completed would otherwise
  // render the wrong tab's rows (e.g. "Mark as Packed" under Completed).
  const tabRef = useRef(tab);

  const load = useCallback(async (forTab: "open" | "completed") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collection-requests?status=${forTab}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pickup requests");
      if (tabRef.current !== forTab) return; // stale response for a tab we've left — ignore it
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      if (tabRef.current !== forTab) return;
      setError(err instanceof Error ? err.message : "Failed to load pickup requests");
    } finally {
      if (tabRef.current === forTab) setLoading(false);
    }
  }, []);

  useEffect(() => {
    tabRef.current = tab;
    load(tab);
  }, [tab, load]);

  const handleMarkPacked = async (id: string) => {
    setPackingId(id);
    try {
      const res = await fetch(`/api/collection-requests/${id}/mark-packed`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark packed");
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark packed");
    } finally {
      setPackingId(null);
    }
  };

  const handleAttribute = async (id: string) => {
    setAttributingId(id);
    try {
      const res = await fetch(`/api/admin/collection-requests/${id}/attribute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to attribute handover");
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attribute handover");
    } finally {
      setAttributingId(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        In-Person Pickup Requests
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab value="open" label="Open" />
        <Tab value="completed" label="Completed" />
      </Tabs>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : requests.length === 0 ? (
        <Typography color="text.secondary">
          {tab === "open" ? "No open pickup requests." : "No completed pickup requests."}
        </Typography>
      ) : (
        requests.map((request) => {
          const customerName = request.customer.username ?? request.customer.firstName ?? request.customer.email;
          return (
            <Card key={request.id} sx={{ mb: 2, border: "1px solid #e5e7eb" }} variant="outlined">
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{request.requestRef}</Typography>
                    <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
                      {customerName} · {request.cards.length} card{request.cards.length !== 1 ? "s" : ""}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={
                      request.status === "COLLECTED"
                        ? "Collected"
                        : request.status === "PACKED"
                        ? "Packed — awaiting customer"
                        : "Needs packing"
                    }
                    sx={{
                      fontWeight: 600,
                      bgcolor: request.status === "COLLECTED" ? "#e0e7ff" : request.status === "PACKED" ? "#dcfce7" : "#fef3c7",
                      color: request.status === "COLLECTED" ? "#3730a3" : request.status === "PACKED" ? "#166534" : "#92400e",
                    }}
                  />
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {request.cards.map((card) => (
                    <Chip key={card.id} size="small" variant="outlined" label={`${card.title} (${card.condition})`} />
                  ))}
                </Box>

                {request.status === "REQUESTED" && (
                  <Button
                    variant="contained"
                    size="small"
                    disabled={packingId === request.id}
                    onClick={() => handleMarkPacked(request.id)}
                    sx={{ mt: 2, textTransform: "none", fontWeight: 700, bgcolor: "#111827", "&:hover": { bgcolor: "#1f2937" } }}
                  >
                    {packingId === request.id ? "Marking…" : "Mark as Packed"}
                  </Button>
                )}

                {request.status === "COLLECTED" && (
                  <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
                      Collected {new Date(request.collectedAt as string).toLocaleDateString()}
                    </Typography>
                    {request.collectedByStaff ? (
                      <Chip size="small" label={`Handled by ${request.collectedByStaff.username ?? "staff"}`} />
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={attributingId === request.id}
                        onClick={() => handleAttribute(request.id)}
                        sx={{ textTransform: "none" }}
                      >
                        {attributingId === request.id ? "Saving…" : "Attribute to me"}
                      </Button>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </Container>
  );
}
