"use client";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperCore } from "swiper/types";

import { Navigation, Pagination, Autoplay } from "swiper/modules";
import { useEffect, useState, useRef } from "react"; // <-- Import useRef
import { Box } from "@mui/material";
import "./CarouselStyles.css";

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

export default function Carousel() {
  const swiperRef = useRef<SwiperCore | null>(null);

  // 2. Use onSwiper to store the instance
  const handleSwiper = (swiper: SwiperCore) => {
    swiperRef.current = swiper;
  };

  useEffect(() => {
    // 3. Update Swiper after component mounts and forces layout calculation
    if (swiperRef.current) {
      // Small timeout to ensure all DOM operations are complete
      const timer = setTimeout(() => {
        swiperRef.current!.update(); // Optional: use the non-null assertion '!' for clarity
      }, 50); // Try 0, 50, or 100 milliseconds
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Swiper
      className="custom-carousel"
      onSwiper={handleSwiper} // <-- 4. Store the swiper instance
      modules={[Navigation, Pagination, Autoplay]}
      speed={800}
      slidesPerView={1}
      centeredSlides
      loop
      autoplay={{ delay: 2500, disableOnInteraction: false }}
      pagination={{ clickable: true }}
      navigation
      breakpoints={{
        1000: { slidesPerView: 1.5 },
        1480: { slidesPerView: 1.6 },
        1700: { slidesPerView: 2.5 },
      }}
      observer={true} //This dont work
      observeParents={true} //This dont work
    >
      {items.map((item, index) => (
        <SwiperSlide key={index} className="custom-slide">
          <a href={item.url} style={{ display: "block", width: "100%" }}>
            <Box
              sx={{
                backgroundImage: `url(${item.image})`,
                // backgroundSize: "cover",
                // backgroundPosition: "center",
                height: {
                  xs: "450px",
                  xl: "550px",
                },
                // width: "100%",
                // display: "flex",
                // alignItems: "center",
                // justifyContent: "center",
                // color: "white",
                // textAlign: "center",
              }}
            >
              {/* Optional overlay content */}
              {/* <Box>
                <h2>{item.title}</h2>
                <p>{item.subtitle}</p>
              </Box> */}
            </Box>
          </a>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
