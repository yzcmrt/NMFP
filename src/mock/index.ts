import { 
  CarModel, 
  UserCar, 
  Transaction,
  Garage,
  MiningSession,
  Task,
  User,
  CarStatus, 
  TransactionStatus,
  TransactionType,
  Rarity
} from '@/types';

// Porsche araç modellerinin listesi
export const mockCarModels: CarModel[] = [
  // 911 Serisi
  {
    modelId: "911_carrera",
    name: "911 Carrera",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera.jpg",
    miningPower: 388,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "911_carrera_cabriolet",
    name: "911 Carrera Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-cabriolet.jpg",
    miningPower: 388,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "911_carrera_t",
    name: "911 Carrera T",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-t.jpg",
    miningPower: 388,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "911_carrera_t_cabriolet",
    name: "911 Carrera T Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-t-cabriolet.jpg",
    miningPower: 388,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "911_carrera_s",
    name: "911 Carrera S",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-s.jpg",
    miningPower: 473,
    nftLimit: 5000,
    rarity: Rarity.RARE
  },
  {
    modelId: "911_carrera_s_cabriolet",
    name: "911 Carrera S Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-s-cabriolet.jpg",
    miningPower: 473,
    nftLimit: 5000,
    rarity: Rarity.RARE
  },
  {
    modelId: "911_carrera_gts",
    name: "911 Carrera GTS",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-gts.jpg",
    miningPower: 532,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_carrera_gts_cabriolet",
    name: "911 Carrera GTS Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-gts-cabriolet.jpg",
    miningPower: 532,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_carrera_4_gts",
    name: "911 Carrera 4 GTS",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-4-gts.jpg",
    miningPower: 532,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_carrera_4_gts_cabriolet",
    name: "911 Carrera 4 GTS Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-carrera-4-gts-cabriolet.jpg",
    miningPower: 532,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_targa_4_gts",
    name: "911 Targa 4 GTS",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-targa-4-gts.jpg",
    miningPower: 532,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_gt3",
    name: "911 GT3",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-gt3.jpg",
    miningPower: 502,
    nftLimit: 2500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_gt3_touring",
    name: "911 GT3 Touring",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-gt3-touring.jpg",
    miningPower: 502,
    nftLimit: 2500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_gt3_rs",
    name: "911 GT3 RS",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-gt3-rs.jpg",
    miningPower: 518,
    nftLimit: 911,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "911_s_t",
    name: "911 S/T",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-s-t.jpg",
    miningPower: 518,
    nftLimit: 911,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "911_turbo",
    name: "911 Turbo",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-turbo.jpg",
    miningPower: 572,
    nftLimit: 1000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_turbo_cabriolet",
    name: "911 Turbo Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-turbo-cabriolet.jpg",
    miningPower: 572,
    nftLimit: 1000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "911_turbo_s",
    name: "911 Turbo S",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-turbo-s.jpg",
    miningPower: 640,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "911_turbo_s_cabriolet",
    name: "911 Turbo S Cabriolet",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-turbo-s-cabriolet.jpg",
    miningPower: 640,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "911_turbo_50_year",
    name: "911 Turbo 50 Year",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-turbo-50-year.jpg",
    miningPower: 640,
    nftLimit: 911,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "911_dakar",
    name: "911 Dakar",
    brand: "Porsche",
    series: "911",
    image: "/gamefi/cars/911/911-dakar.jpg",
    miningPower: 473,
    nftLimit: 1000,
    rarity: Rarity.EPIC
  },
  
  // 718 Serisi
  {
    modelId: "718_cayman",
    name: "718 Cayman",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-cayman.jpg",
    miningPower: 300,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "718_cayman_s",
    name: "718 Cayman S",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-cayman-s.jpg",
    miningPower: 350,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "718_cayman_style_edition",
    name: "718 Cayman Style Edition",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-cayman-style-edition.jpg",
    miningPower: 300,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "718_cayman_gts_4",
    name: "718 Cayman GTS 4.0",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-cayman-gts-4.0.jpg",
    miningPower: 394,
    nftLimit: 5000,
    rarity: Rarity.RARE
  },
  {
    modelId: "718_boxster",
    name: "718 Boxster",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-boxster.jpg",
    miningPower: 300,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "718_boxster_s",
    name: "718 Boxster S",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-boxster-s.jpg",
    miningPower: 350,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "718_boxster_style_edition",
    name: "718 Boxster Style Edition",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-boxster-style-edition.jpg",
    miningPower: 300,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "718_boxster_gts_4",
    name: "718 Boxster GTS 4.0",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-boxster-gts-4.0.jpg",
    miningPower: 394,
    nftLimit: 5000,
    rarity: Rarity.RARE
  },
  {
    modelId: "718_cayman_gt4_rs",
    name: "718 Cayman GT4 RS",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-cayman-gt4-rs.jpg",
    miningPower: 493,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "718_spyder_rs",
    name: "718 Spyder RS",
    brand: "Porsche",
    series: "718",
    image: "/gamefi/cars/718/718-spyder-rs.jpg",
    miningPower: 493,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  
  // Taycan Serisi
  {
    modelId: "taycan",
    name: "Taycan",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan.jpg",
    miningPower: 402,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "taycan_4",
    name: "Taycan 4",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-4.jpg",
    miningPower: 402,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "taycan_4s",
    name: "Taycan 4S",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-4s.jpg",
    miningPower: 536,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "taycan_gts",
    name: "Taycan GTS",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-gts.jpg",
    miningPower: 690,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "taycan_turbo",
    name: "Taycan Turbo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo.jpg",
    miningPower: 871,
    nftLimit: 5000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "taycan_turbo_s",
    name: "Taycan Turbo S",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-s.jpg",
    miningPower: 938,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "taycan_turbo_gt",
    name: "Taycan Turbo GT",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-gt.jpg",
    miningPower: 1019,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "taycan_turbo_gt_weissach",
    name: "Taycan Turbo GT with Weissach Pack",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-gt-weissach.jpg",
    miningPower: 1019,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "taycan_4_cross_turismo",
    name: "Taycan 4 Cross Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-4-cross-turismo.jpg",
    miningPower: 429,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "taycan_4s_cross_turismo",
    name: "Taycan 4S Cross Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-4s-cross-turismo.jpg",
    miningPower: 590,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "taycan_turbo_cross_turismo",
    name: "Taycan Turbo Cross Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-cross-turismo.jpg",
    miningPower: 871,
    nftLimit: 5000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "taycan_turbo_s_cross_turismo",
    name: "Taycan Turbo S Cross Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-s-cross-turismo.jpg",
    miningPower: 938,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "taycan_gts_cross_turismo",
    name: "Taycan GTS Cross Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-gts-cross-turismo.jpg",
    miningPower: 690,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "taycan_sport_turismo",
    name: "Taycan Sport Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-sport-turismo.jpg",
    miningPower: 402,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "taycan_4s_sport_turismo",
    name: "Taycan 4S Sport Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-4s-sport-turismo.jpg",
    miningPower: 536,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "taycan_gts_sport_turismo",
    name: "Taycan GTS Sport Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-gts-sport-turismo.jpg",
    miningPower: 690,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "taycan_turbo_sport_turismo",
    name: "Taycan Turbo Sport Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-sport-turismo.jpg",
    miningPower: 871,
    nftLimit: 5000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "taycan_turbo_s_sport_turismo",
    name: "Taycan Turbo S Sport Turismo",
    brand: "Porsche",
    series: "Taycan",
    image: "/gamefi/cars/taycan/taycan-turbo-s-sport-turismo.jpg",
    miningPower: 938,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  
  // 918 Serisi
  {
    modelId: "918_spyder",
    name: "918 Spyder",
    brand: "Porsche",
    series: "918",
    image: "/gamefi/cars/918/918-spyder.jpg",
    miningPower: 887,
    nftLimit: 918,
    rarity: Rarity.LEGENDARY
  },
  
  // Cayenne Serisi
  {
    modelId: "cayenne",
    name: "Cayenne",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne.jpg",
    miningPower: 348,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "cayenne_coupe",
    name: "Cayenne Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-coupe.jpg",
    miningPower: 348,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "cayenne_e_hybrid",
    name: "Cayenne E-Hybrid",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-e-hybrid.jpg",
    miningPower: 463,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "cayenne_e_hybrid_coupe",
    name: "Cayenne E-Hybrid Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-e-hybrid-coupe.jpg",
    miningPower: 463,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "cayenne_s_e_hybrid",
    name: "Cayenne S E-Hybrid",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-s-e-hybrid.jpg",
    miningPower: 512,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "cayenne_s_e_hybrid_coupe",
    name: "Cayenne S E-Hybrid Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-s-e-hybrid-coupe.jpg",
    miningPower: 512,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "cayenne_s",
    name: "Cayenne S",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-s.jpg",
    miningPower: 468,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "cayenne_s_coupe",
    name: "Cayenne S Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-s-coupe.jpg",
    miningPower: 468,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "cayenne_gts",
    name: "Cayenne GTS",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-gts.jpg",
    miningPower: 493,
    nftLimit: 10000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "cayenne_gts_coupe",
    name: "Cayenne GTS Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-gts-coupe.jpg",
    miningPower: 493,
    nftLimit: 10000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "cayenne_turbo_gt_coupe",
    name: "Cayenne Turbo GT Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-turbo-gt-coupe.jpg",
    miningPower: 650,
    nftLimit: 2500,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "cayenne_turbo_s_e_hybrid",
    name: "Cayenne Turbo S E-Hybrid",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-turbo-s-e-hybrid.jpg",
    miningPower: 729,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "cayenne_turbo_s_e_hybrid_coupe",
    name: "Cayenne Turbo S E-Hybrid Coupe",
    brand: "Porsche",
    series: "Cayenne",
    image: "/gamefi/cars/cayenne/cayenne-turbo-s-e-hybrid-coupe.jpg",
    miningPower: 729,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  
  // Panamera Serisi
  {
    modelId: "panamera",
    name: "Panamera",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera.jpg",
    miningPower: 348,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "panamera_4",
    name: "Panamera 4",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera-4.jpg",
    miningPower: 348,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "panamera_4_e_hybrid",
    name: "Panamera 4 E-Hybrid",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera-4-e-hybrid.jpg",
    miningPower: 463,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "panamera_4s_e_hybrid",
    name: "Panamera 4S E-Hybrid",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera-4s-e-hybrid.jpg",
    miningPower: 536,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
  {
    modelId: "panamera_gts",
    name: "Panamera GTS",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera-gts.jpg",
    miningPower: 493,
    nftLimit: 10000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "panamera_turbo_e_hybrid",
    name: "Panamera Turbo E-Hybrid",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera-turbo-e-hybrid.jpg",
    miningPower: 670,
    nftLimit: 5000,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "panamera_turbo_s_e_hybrid",
    name: "Panamera Turbo S E-Hybrid",
    brand: "Porsche",
    series: "Panamera",
    image: "/gamefi/cars/panamera/panamera-turbo-s-e-hybrid.jpg",
    miningPower: 771,
    nftLimit: 1000,
    rarity: Rarity.LEGENDARY
  },
  
  // Macan Serisi
  {
    modelId: "macan_electric",
    name: "Macan Electric",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-electric.jpg",
    miningPower: 355,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "macan_4_electric",
    name: "Macan 4 Electric",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-4-electric.jpg",
    miningPower: 402,
    nftLimit: 7500,
    rarity: Rarity.RARE
  },
  {
    modelId: "macan_4s_electric",
    name: "Macan 4S Electric",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-4s-electric.jpg",
    miningPower: 509,
    nftLimit: 5000,
    rarity: Rarity.EPIC
  },
  {
    modelId: "macan_turbo_electric",
    name: "Macan Turbo Electric",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-turbo-electric.jpg",
    miningPower: 630,
    nftLimit: 2500,
    rarity: Rarity.LEGENDARY
  },
  {
    modelId: "macan",
    name: "Macan",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan.jpg",
    miningPower: 261,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "macan_t",
    name: "Macan T",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-t.jpg",
    miningPower: 261,
    nftLimit: 10000,
    rarity: Rarity.COMMON
  },
  {
    modelId: "macan_s",
    name: "Macan S",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-s.jpg",
    miningPower: 375,
    nftLimit: 10000,
    rarity: Rarity.RARE
  },
  {
    modelId: "macan_gts",
    name: "Macan GTS",
    brand: "Porsche",
    series: "Macan",
    image: "/gamefi/cars/macan/macan-gts.jpg",
    miningPower: 434,
    nftLimit: 7500,
    rarity: Rarity.EPIC
  },
];

// Örnek kullanıcı araçları
export const mockUserCars: UserCar[] = [
  {
    id: 1,
    modelId: "taycan_turbo_s",
    name: "Taycan Turbo S",
    level: 3,
    fuel: 80,
    condition: 95,
    inGarage: "Premium Garaj",
    status: CarStatus.ACTIVE
  },
  {
    id: 2,
    modelId: "911_carrera",
    name: "911 Carrera",
    level: 2,
    fuel: 65,
    condition: 70,
    inGarage: "Standart Garaj",
    status: CarStatus.REPAIRING,
    repairTimeLeft: '1 saat 23 dk'
  },
  {
    id: 3,
    modelId: "taycan",
    name: "Taycan",
    level: 1,
    fuel: 100,
    condition: 100,
    inGarage: "Standart Garaj",
    status: CarStatus.INACTIVE
  }
];

// Örnek işlem verileri
export const mockTransactions: Transaction[] = [
  {
    id: 1,
    type: TransactionType.DEPOSIT,
    amount: 5000,
    date: '2023-05-15T14:30:00',
    status: TransactionStatus.CONFIRMED,
    address: '0x8a7d...f3e9',
  },
  {
    id: 2,
    type: TransactionType.WITHDRAW,
    amount: 2500,
    date: '2023-05-10T09:15:00',
    status: TransactionStatus.CONFIRMED,
    address: '0x8a7d...f3e9',
  },
  {
    id: 3,
    type: TransactionType.REWARD,
    amount: 750,
    date: '2023-05-08T18:45:00',
    status: TransactionStatus.CONFIRMED,
    source: 'Daily login bonus'
  },
  {
    id: 4,
    type: TransactionType.PURCHASE,
    amount: 1200,
    date: '2023-05-05T11:20:00',
    status: TransactionStatus.CONFIRMED,
    item: 'Premium Garage Slot'
  }
];

// Örnek garaj verileri
export const mockGarages: Garage[] = [
  {
    id: 1,
    name: 'Premium Garaj',
    image: '/images/garage-1.png',
    capacity: 3,
    occupied: 2,
    dailyBonus: 50,
    level: 2,
    value: 4500,
    location: 'İstanbul',
  },
  {
    id: 2,
    name: 'Standart Garaj',
    image: '/images/garage-2.png',
    capacity: 2,
    occupied: 1,
    dailyBonus: 25,
    level: 1,
    value: 2200,
    location: 'Ankara',
  }
];

// Mining oturumu örnek verisi
export const mockMiningSession: MiningSession = {
  id: '1',
  carId: 1,
  garageId: 1,
  startTime: new Date(new Date().getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 saat önce
  endTime: new Date(new Date().getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 saat sonra
  expectedReward: 250,
  status: 'active'
};

// Görev örnek verileri
export const mockTasks: Task[] = [
  {
    id: 1,
    title: 'Günlük Sürüş',
    description: 'Araban ile 100 km yol kat et',
    reward: 150,
    progress: 65,
    total: 100,
    unit: 'km',
    icon: '/images/task-driving.svg',
    timeRemaining: '11 saat',
  },
  {
    id: 2,
    title: 'Yakıt Doldur',
    description: '10 araç için yakıt satın al',
    reward: 300,
    progress: 4,
    total: 10,
    unit: 'araç',
    icon: '/images/task-fuel.svg',
    timeRemaining: '23 saat',
  },
  {
    id: 3,
    title: 'Garaj Yönetimi',
    description: 'Garajını ziyaret et ve bakım yap',
    reward: 200,
    progress: 0,
    total: 1,
    unit: 'ziyaret',
    icon: '/images/task-garage.svg',
    timeRemaining: '23 saat',
  }
];

// Tamamlanan görev örnek verileri
export const mockCompletedTasks: Task[] = [
  {
    id: 4,
    title: 'Referans Bonusu',
    description: '3 arkadaşını davet et',
    reward: 500,
    progress: 3,
    total: 3,
    unit: 'arkadaş',
    icon: '/images/task-referral.svg',
    timeRemaining: '0',
    isCompleted: true,
    completedAt: '12 Ağustos 2023',
  }
];

// Kullanıcı örnek verisi
export const mockUser: User = {
  id: 1,
  username: 'kullanici1',
  walletAddress: '0x8a7d3e6Ee259452585d74b5B1D0627af3e9c5f3e9',
  balance: 25000,
  xp: 24680,
  level: 35
}; 