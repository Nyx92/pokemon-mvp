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

interface Product {
  id: number;
  title: string;
  price: number;
  condition: "New" | "Used";
  image: string;
  url: string;
}

const products: Product[] = [
  {
    id: 1,
    title: "Charizard VMAX",
    price: 120,
    condition: "New",
    image: "/cards/charizard.png",
    url: "/product/1",
  },
  {
    id: 2,
    title: "Pikachu Promo (McDonald's)",
    price: 15.5,
    condition: "Used",
    image: "/cards/pikachu.png",
    url: "/product/2",
  },
  {
    id: 3,
    title: "Mewtwo EX",
    price: 40,
    condition: "New",
    image: "/cards/mewtwo.png",
    url: "/product/3",
  },
  {
    id: 4,
    title: "Snorlax V",
    price: 25,
    condition: "New",
    image: "/cards/snorlax.png",
    url: "/product/4",
  },
  {
    id: 5,
    title: "Eevee GX",
    price: 30,
    condition: "Used",
    image: "/cards/eevee.png",
    url: "/product/5",
  },
  {
    id: 6,
    title: "Blastoise Holo Rare",
    price: 80,
    condition: "New",
    image: "/cards/blastoise.png",
    url: "/product/6",
  },
  {
    id: 7,
    title: "Venusaur V",
    price: 55,
    condition: "Used",
    image: "/cards/venusaur.png",
    url: "/product/7",
  },
  {
    id: 8,
    title: "Gyarados EX",
    price: 35,
    condition: "New",
    image: "/cards/gyarados.png",
    url: "/product/8",
  },
  {
    id: 9,
    title: "Alakazam Holo",
    price: 45,
    condition: "Used",
    image: "/cards/alakazam.png",
    url: "/product/9",
  },
  {
    id: 10,
    title: "Jigglypuff Promo",
    price: 12,
    condition: "New",
    image: "/cards/jigglypuff.png",
    url: "/product/10",
  },
  {
    id: 11,
    title: "Dragonite VSTAR",
    price: 65,
    condition: "New",
    image: "/cards/dragonite.png",
    url: "/product/11",
  },
  {
    id: 12,
    title: "Machamp Holo Rare",
    price: 22,
    condition: "Used",
    image: "/cards/machamp.png",
    url: "/product/12",
  },
  {
    id: 13,
    title: "Zapdos EX",
    price: 50,
    condition: "New",
    image: "/cards/zapdos.png",
    url: "/product/13",
  },
  {
    id: 14,
    title: "Moltres Promo",
    price: 42,
    condition: "Used",
    image: "/cards/moltres.png",
    url: "/product/14",
  },
  {
    id: 15,
    title: "Articuno GX",
    price: 48,
    condition: "New",
    image: "/cards/articuno.png",
    url: "/product/15",
  },
  {
    id: 16,
    title: "Gengar Holo",
    price: 38,
    condition: "New",
    image: "/cards/gengar.png",
    url: "/product/16",
  },
  {
    id: 17,
    title: "Lucario VSTAR",
    price: 28,
    condition: "Used",
    image: "/cards/lucario.png",
    url: "/product/17",
  },
  {
    id: 18,
    title: "Sylveon V",
    price: 34,
    condition: "New",
    image: "/cards/sylveon.png",
    url: "/product/18",
  },
  {
    id: 19,
    title: "Umbreon GX",
    price: 70,
    condition: "Used",
    image: "/cards/umbreon.png",
    url: "/product/19",
  },
  {
    id: 20,
    title: "Espeon EX",
    price: 65,
    condition: "New",
    image: "/cards/espeon.png",
    url: "/product/20",
  },
];

const SegmentTwo = () => {
  return (
    <Box sx={{ px: 4, py: 6 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Pokémon Card Inventory
      </Typography>

      <Grid container spacing={2}>
        {products.map((product) => (
          <Grid key={product.id} item xs={6} sm={4} md={2}>
            <Link href={product.url} style={{ textDecoration: "none" }}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: 2,
                  borderRadius: 2,
                  "&:hover": { boxShadow: 5, transform: "scale(1.02)" },
                  transition: "0.2s",
                }}
              >
                {/* Image section */}
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

                {/* Content */}
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
  );
};

export default SegmentTwo;
