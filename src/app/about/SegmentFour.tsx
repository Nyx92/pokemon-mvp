import { Box, Typography, Card, CardContent, CardMedia } from "@mui/material";

// Define an interface for props if you expect to receive any props
interface SegmentFourProps {
  // add if required
}

const SegmentFour: React.FC<SegmentFourProps> = (props) => {
  return (
    <Box
      sx={{
        display: "flex",
        backgroundColor: "#fafafc",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden", // Prevents horizontal scroll due to overflow
        paddingBottom: "5%",
      }}
    >
      <Box
        sx={{
          width: "100%",
          minHeight: "20vh",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: { md: "100%", lg: "80%" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: "1200px", // Optional, for better readability on very wide screens
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "20px", md: "30px", lg: "40px" },
              fontWeight: "bold",
              color: "Black",
              fontFamily: "Roboto, sans-serif",
              letterSpacing: "-0.02em",
              marginBottom: "30px",
            }}
          >
            Meet Our Team
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexDirection: { sm: "column", md: "row" },
              flexWrap: "wrap",
              gap: "20px",
              justifyContent: "center",
            }}
          >
            {/* Profile Card for Denise Leong */}
            <Card sx={{ maxWidth: { sm: "100%", md: "45%" }, boxShadow: 3 }}>
              <CardMedia
                component="img"
                height="350"
                image="/about/denise.jpg" // Placeholder image path
                alt="Denise Leong"
              />
              <CardContent>
                <Typography variant="h6" component="div">
                  Denise Leong
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Founding CEO and Artistic Director
                </Typography>
                <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                  Denise is a community dance artist and arts manager whose
                  heart goes out to communities in need. As a firm believer that
                  dance is integral to healthcare, she is passionate about
                  exploring the rich possibilities that exist where the arts and
                  the sciences overlap. As a self-professed late bloomer in
                  dance, she doesn't have highly technical skills. Although as a
                  strong advocate of community dance, Denise believes that gives
                  her an edge in connecting with the people she seeks to share
                  dance with and also allows her to embody what she so often
                  shares about dance — that dance truly is for every body.
                  <br />
                  <br />
                  Denise is a recipient of NAC Arts Scholar (2022) and TCL
                  Scholar pursuing a Master in Dance Leadership and Community
                  Practice. She graduated with a Postgraduate Diploma in
                  Community Dance in Trinity Laban Conservatoire of Music and
                  Dance (UK) in 2019 and was awarded the Trinity Laban Dance
                  Award in 2018/2019. As a community dance artist, Denise worked
                  with acclaimed arts companies and diverse community and health
                  organisations in UK and Singapore, including Trinity Laban,
                  Dance Umbrella, Royal Ballet, Breathe Arts Health Research,
                  Dementia Singapore, Singapore Association of Mental Health,
                  Methodist Welfare Services Girls’ Home, St. Luke’s Eldercare
                  and St. Luke’s Hospital, Jurong Community Hospital, Tsao
                  Foundation, Presbyterian Community Services to name a few.{" "}
                  <br />
                  <br />
                  In addition to her work as a community dance artist, Denise
                  has also served as an arts manager for the National Arts
                  Council (NAC) of Singapore, The Human Expression (T.H.E) Dance
                  Company, and cont·act Contemporary Dance Festival. She holds
                  certifications in An Introduction to Safe Dance Practice in
                  MOE Schools from Nanyang Academy of Fine Arts (NAFA), En Route
                  to Inclusivity: Working with Children with Disabilities in and
                  through the Arts from Rainbow Centre, and Dance for
                  Parkinson's Disease Dance Teacher Certification from Mark
                  Morris Dance Group (USA).
                </Typography>
              </CardContent>
            </Card>

            {/* Profile Card for Yu-tzu Lin */}
            <Card sx={{ maxWidth: { sm: "100%", md: "45%" }, boxShadow: 3 }}>
              <CardMedia
                component="img"
                height="350"
                image="/about/yu-tzu.jpg" // Placeholder image path
                alt="Yu-tzu Lin"
              />
              <CardContent>
                <Typography variant="h6" component="div">
                  Yu-tzu Lin
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Dance Artist
                </Typography>
                <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
                  Meet Yu-tzu, a passionate choreographer, dance teacher, and
                  dance artist, recognized for her expertise and range of skills
                  across various disciplines. She graduated with a Masters in
                  Dance Science from Trinity Laban Conservatoire of Music and
                  Dance in the UK in 2023,as well as a Double Major in Chinese
                  Dance and Ballet from the University of Taipei in Taiwan.
                  <br />
                  <br />
                  Yu-tzu has choreographed both on and off-campus, been selected
                  for performances, and won awards. With her rich experience in
                  performance, Yu-tzu has been invited to participate in foreign
                  dance art festivals such as XXIX International Folklore
                  Festival CLOFF I.O.V Šumperk in the Czech Republic, 32’FOLK
                  MONÇĀO in Portugal, Dance Stages in China-Shanghai, Fringe and
                  Alnwick International Music Festival in the United Kingdom.
                  She is also a certified Polestar Pilates instructor for Mat
                  and Apparatus, a technician for Massage, and an ACE-certified
                  Personal Trainer. She developed teaching systems and served as
                  an instructor at the Frances Pilates Method (FPM) Academy.
                  When she’s not performing, you will likely find her teaching
                  and sharing her love for dance and pilates.
                  <br />
                  <br />
                  Yu-tzu teaches Ballet, Chinese Dance, Contemporary Dance,
                  Improvisation and also conducts group and individual Pilates
                  courses at well-known centers such as Just Well Balanced Body
                  Center, XOJON Lifestyle, Soka Dance Center, Sweet* Fitness,
                  Surmount Fitness, and Yihui Dance Theatre.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SegmentFour;
