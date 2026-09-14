"use client";
/**
 * AdminCollectionRequests — staff view of open (REQUESTED/PACKED)
 * in-person pickup requests. Lets staff mark a request "Packed" once
 * they've physically pulled and bagged the cards; the customer is then
 * notified in-app and can request their own pickup verification code.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Container, Typography, Box, Card, CardContent, Chip, Button,
  CircularProgress, Alert, Divider,
} from "@mui/material";

interface AdminCard {
  id: string;
  title: string;
  condition: string;
}

interface AdminCollectionRequest {
  id: string;
  requestRef: string;
  status: "REQUESTED" | "PACKED";
  requestedAt: string;
  packedAt: string | null;
  customer: { username: string | null; firstName: string | null; email: string };
  cards: AdminCard[];
}

export default function AdminCollectionRequests() {
  const [requests, setRequests] = useState<AdminCollectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packingId, setPackingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/collection-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pickup requests");
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pickup requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkPacked = async (id: string) => {
    setPackingId(id);
    try {
      const res = await fetch(`/api/collection-requests/${id}/mark-packed`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark packed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark packed");
    } finally {
      setPackingId(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
        In-Person Pickup Requests
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : requests.length === 0 ? (
        <Typography color="text.secondary">No open pickup requests.</Typography>
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
                    label={request.status === "PACKED" ? "Packed — awaiting customer" : "Needs packing"}
                    sx={{
                      fontWeight: 600,
                      bgcolor: request.status === "PACKED" ? "#dcfce7" : "#fef3c7",
                      color: request.status === "PACKED" ? "#166534" : "#92400e",
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
              </CardContent>
            </Card>
          );
        })
      )}
    </Container>
  );
}
