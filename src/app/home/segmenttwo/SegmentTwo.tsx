"use client";

import React from "react";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Grid,
} from "@mui/material";

import { products } from "./mockdata";

const SegmentTwo = () => {
  return (
    <Box sx={{ px: 4, py: 6 }}>
      <Typography
        variant="h4"
        fontWeight="bold"
        gutterBottom
        textAlign="center"
      >
        Pokémon Card Inventory
      </Typography>

      {/* Wrapper to limit grid width */}
      <Box sx={{ width: "80%", mx: "auto" }}>
        {" "}
        <Grid container spacing={3} justifyContent="center">
          {products.map((product) => (
            <Grid
              key={product.id}
              size={{ xs: 12, sm: 6, md: 3, lg: 2 }}
              display="flex"
              justifyContent="center"
            >
              <Link href={product.url} style={{ textDecoration: "none" }}>
                <Card
                  sx={{
                    width: 320, // ✅ fixed card width
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: 2,
                    borderRadius: 2,
                    "&:hover": { boxShadow: 5, transform: "scale(1.02)" },
                    transition: "0.2s",
                  }}
                >
                  <CardMedia
                    component="img"
                    image={product.image}
                    alt={product.title}
                    sx={{
                      height: 280,
                      objectFit: "contain",
                      backgroundColor: "#f8f8f8",
                    }}
                  />
                  <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                      {product.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Condition: {product.condition}
                    </Typography>
                    <Typography
                      variant="subtitle1"
                      fontWeight="bold"
                      color="primary"
                      sx={{ mt: 0.5 }}
                    >
                      ${product.price.toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Link>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default SegmentTwo;
