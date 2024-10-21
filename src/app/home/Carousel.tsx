"use client";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";
// import Swiper core and required modules
import {
  Navigation,
  Pagination,
  Scrollbar,
  A11y,
  Autoplay,
} from "swiper/modules";
import { Box } from "@mui/material";
import "./CarouselStyles.css";

// Define the type for carousel items
interface CarouselItem {
  image: string;
  title: string;
  subtitle: string;
}

// CarouselItem[] is a TypeScript array type that means "an array of CarouselItem objects."
const items: CarouselItem[] = [
  {
    image: "/carousel/carousel_home_1.png",
    title: "",
    subtitle: "",
  },
  {
    image: "/carousel/carousel_home_2.png",
    title: "",
    subtitle: "",
  },
  {
    image: "/carousel/carousel_home_1.png",
    title: "",
    subtitle: "",
  },
  {
    image: "/carousel/carousel_home_2.png",
    title: "",
    subtitle: "",
  },
];

const Carousel: React.FC = () => {
  return (
    <Swiper
      className="custom-carousel"
      modules={[Navigation, Pagination, Scrollbar, A11y, Autoplay]}
      speed={2000} // Increase the transition duration (value is in ms)
      effect={"slide"}
      spaceBetween={10} // Reduced gap between slides
      slidesPerView={1} // Show the middle slide fully and parts of the previous next slides
      centeredSlides={true} // Ensures the center slide is always in the middle
      loop={true}
      autoplay={{ delay: 2500, disableOnInteraction: false }}
      pagination={{
        clickable: true,
        el: ".swiper-pagination",
        renderBullet: (index, className) => {
          return '<span class="' + className + '">' + (index + 1) + "</span>";
        },
      }}
      scrollbar={{ draggable: true }}
      breakpoints={{
        1000: {
          slidesPerView: 1.5,
        },
        1480: {
          slidesPerView: 1.6,
        },
        1700: {
          slidesPerView: 2.5,
        },
      }}
    >
      {items.map((item, index) => (
        <SwiperSlide key={index} className="custom-slide">
          <Box
            sx={{
              backgroundImage: `url(${item.image})`,
              backgroundSize: "cover", // ensures that the background image covers the entire area of the container
              backgroundPosition: "center",
              height: {
                xs: "450px",
                xl: "550px", // height for xl breakpoint
              },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              textAlign: "center",
            }}
          >
            <Box>
              <h2>{item.title}</h2>
              <p>{item.subtitle}</p>
            </Box>
          </Box>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default Carousel;
