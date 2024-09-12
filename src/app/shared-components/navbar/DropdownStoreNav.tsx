import { Button, Typography, Box, Grid2, SxProps, Theme } from "@mui/material";
import { dropdownData, MenuKey } from "./DropdownStoreData";
import "./Navbar.css";

// Define WhiteButton
const WhiteButton: React.FC<{ children: React.ReactNode }> = (props) => {
  return (
    <Button
      {...props}
      sx={{
        color: "white",
        padding: {
          md: "2px 0px",
          lg: "3px 0px", // 3px for large screens
          xl: "6px 0px", // 6px for extra-large screens
        },
        textTransform: "capitalize",
        fontSize: { md: "20px", lg: "22px", xl: "27px" },
        fontFamily:
          "SF Pro Display,SF Pro Icons,Helvetica Neue,Helvetica,Arial,sans-serif",
        textAlign: "left",
        justifyContent: "flex-start",
      }}
    >
      {props.children}
    </Button>
  );
};

// Define GreyButton
const GreyButton: React.FC<{ children: React.ReactNode }> = (props) => {
  return (
    <Button
      {...props}
      sx={{
        color: "var(--r-globalnav-color-secondary)",
        padding: "4px 0px", // This will remove the left padding
        textTransform: "capitalize",
        fontSize: { md: "12px", lg: "12px", xl: "15px" },
        fontFamily:
          "SF Pro Display,SF Pro Icons,Helvetica Neue,Helvetica,Arial,sans-serif",
        textAlign: "left",
        justifyContent: "flex-start",
      }}
    >
      {props.children}
    </Button>
  );
};

// Define the types for the props
interface DropdownStoreNavProps {
  currentMenu: MenuKey; // Use the MenuKey type here
  sx?: SxProps<Theme>;
}

export default function DropdownStoreNav({
  currentMenu,
  sx,
}: DropdownStoreNavProps) {
  const menuData = dropdownData[currentMenu];

  // If there's no matching content, we can choose to render nothing or some default content
  if (!menuData) {
    return null; // or any other default content you'd like to show
  }

  return (
    <Box sx={{ ...sx }}>
      <Grid2 container spacing={2}>
        {menuData.sections.map((section, index) => (
          <Grid2
            key={index}
            sx={{
              // flexBasis determines the initial size of a flex item (in this case, your grid item).
              flexBasis: {
                xs: "100%",
                md: "25%",
                lg: index < 1 ? "25%" : "20%",
                xl: index < 1 ? "25%" : "20%",
              },
            }}
          >
            <Typography
              sx={{
                color: "var(--r-globalnav-color-secondary)",
                marginBottom: 2,
              }}
            >
              {section.mainTitle || section.title}
            </Typography>
            {section.items.map((item, itemIndex) => (
              <Box key={itemIndex}>
                {section.mainTitle ? (
                  <WhiteButton>{item}</WhiteButton>
                ) : (
                  <GreyButton>{item}</GreyButton>
                )}
              </Box>
            ))}
          </Grid2>
        ))}
        {/* For the final dropdown column, if it's necessary to explicitly render an empty column, you can do so here. */}
        {menuData.sections.length < 4 && (
          <Grid2
            sx={{
              flexBasis: { xs: "100%", md: "25%", lg: "40%", xl: "40%" },
            }}
          />
        )}
      </Grid2>
    </Box>
  );
}
