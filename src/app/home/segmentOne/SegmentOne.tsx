"use client";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "./carousell.css";

import React from "react";
import Slider from "react-slick";
import { Box } from "@mui/material";

interface CarouselItem {
  id: number;
  image: string;
  url: string;
}

const items: CarouselItem[] = [
  { id: 1, image: "/carousell/carousell_1.png", url: "/default-url" },
  { id: 2, image: "/carousell/carousell_2.png", url: "/default-url" },
  { id: 3, image: "/carousell/carousell_3.png", url: "/default-url" },
  { id: 4, image: "/carousell/carousell_4.png", url: "/default-url" },
  { id: 5, image: "/carousell/carousell_5.png", url: "/default-url" },
];

const SegmentOne = () => {
  const settings = {
    dots: true,
    infinite: true,
    autoplay: true,
    speed: 500,
    slidesToShow: 3, // center + 2 side slides
    slidesToScroll: 1,
    centerMode: true,
    centerPadding: "0px", // no padding between slides
  };

  return (
    <Slider {...settings}>
      {items.map((item) => (
        <a key={item.id} href={item.url} style={{ display: "block" }}>
          <Box
            component="img"
            src={item.image}
            alt={`carousel-${item.id}`}
            sx={{
              width: "100%",
              height: 450, // fixed slide height
              objectFit: "cover", // ✅ fills box completely, no white gaps
              display: "block",
            }}
          />
        </a>
      ))}
    </Slider>
  );
};

export default SegmentOne;
