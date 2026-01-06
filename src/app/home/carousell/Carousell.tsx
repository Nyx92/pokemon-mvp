"use client";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
import { Swiper as SwiperCore } from "swiper/types";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import { useRef } from "react";
import { Box } from "@mui/material";
import "./CarouselStyles.css";

const items = [
  { id: 1, image: "/carousell/carousell_1.png", url: "/default-url" },
  { id: 2, image: "/carousell/carousell_2.png", url: "/default-url" },
  { id: 3, image: "/carousell/carousell_3.png", url: "/default-url" },
  { id: 4, image: "/carousell/carousell_4.png", url: "/default-url" },
  { id: 5, image: "/carousell/carousell_5.png", url: "/default-url" },
];

export default function Carousel() {
  const swiperRef = useRef<SwiperCore | null>(null);

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Swiper
        className="custom-carousel"
        onSwiper={(swiper) => (swiperRef.current = swiper)}
        modules={[Navigation, Pagination, Autoplay]}
        grabCursor={true}
        centeredSlides={true}
        loop={true}
        spaceBetween={30} // Consistent gap
        slidesPerView={"auto"}
        speed={1500} // Much slower, smoother slide transition
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{ clickable: true }}
      >
        {items.map((item, index) => (
          <SwiperSlide key={index} className="custom-slide">
            <a
              href={item.url}
              style={{ display: "block", width: "100%", height: "100%" }}
            >
              <Box
                sx={{
                  backgroundImage: `url(${item.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  height: "100%", // Fills the slide height defined in CSS
                  width: "100%",
                  borderRadius: "12px",
                }}
              />
            </a>
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
}
