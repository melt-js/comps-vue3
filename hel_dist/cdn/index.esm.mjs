import { exposeLib } from 'hel-lib-proxy';

/*
|--------------------------------------------------------------------------
|
| 对应 package.json/appGroupName
|
|--------------------------------------------------------------------------
*/
const LIB_NAME = 'comps-vue3';

/**
 * 将提供给用户的lib暴露出去（同时也暴露了类型）
 */
const dtlib = exposeLib(LIB_NAME);
const HelloWorld = dtlib.HelloWorld;
const CircularMenu = dtlib.CircularMenu;
const CircularMenuV2 = dtlib.CircularMenuV2;
const MagneticButton = dtlib.MagneticButton;
const SpotlightButton = dtlib.SpotlightButton;
const GlowBorder = dtlib.GlowBorder;
const Typewriter = dtlib.Typewriter;
const TiltCard = dtlib.TiltCard;
const FloatingLabelInput = dtlib.FloatingLabelInput;
const PasswordInput = dtlib.PasswordInput;
const ExpandSearch = dtlib.ExpandSearch;
const CyberInput = dtlib.CyberInput;
const CorgiInput = dtlib.CorgiInput;
const GridLoading = dtlib.GridLoading;
const GooeyBallsLoading = dtlib.GooeyBallsLoading;
const DnaLoading = dtlib.DnaLoading;
const NeonRingLoading = dtlib.NeonRingLoading;
const GearLoading = dtlib.GearLoading;
const VortexLoading = dtlib.VortexLoading;
const WaterBallLoading = dtlib.WaterBallLoading;
const HourglassLoading = dtlib.HourglassLoading;
const CubeWaveLoading = dtlib.CubeWaveLoading;
const JellyLoading = dtlib.JellyLoading;
const DominoLoading = dtlib.DominoLoading;
const SlideAuthPanel = dtlib.SlideAuthPanel;
const TerminalAuth = dtlib.TerminalAuth;
const WheelMenuButton = dtlib.WheelMenuButton;
const PhotoSphere = dtlib.PhotoSphere;
const WarpStarfield = dtlib.WarpStarfield;
const ChinaRouteMap = dtlib.ChinaRouteMap;
const SplitCodePreview = dtlib.SplitCodePreview;
const BookFlip = dtlib.BookFlip;
const MinecraftChest = dtlib.MinecraftChest;
const FilmRoll = dtlib.FilmRoll;
const RopeGallery = dtlib.RopeGallery;
const CompareSlider = dtlib.CompareSlider;
const PosterCollage = dtlib.PosterCollage;
const LiftCard = dtlib.LiftCard;
const BilibiliBanner = dtlib.BilibiliBanner;

export { BilibiliBanner, BookFlip, ChinaRouteMap, CircularMenu, CircularMenuV2, CompareSlider, CorgiInput, CubeWaveLoading, CyberInput, DnaLoading, DominoLoading, ExpandSearch, FilmRoll, FloatingLabelInput, GearLoading, GlowBorder, GooeyBallsLoading, GridLoading, HelloWorld, HourglassLoading, JellyLoading, LiftCard, MagneticButton, MinecraftChest, NeonRingLoading, PasswordInput, PhotoSphere, PosterCollage, RopeGallery, SlideAuthPanel, SplitCodePreview, SpotlightButton, TerminalAuth, TiltCard, Typewriter, VortexLoading, WarpStarfield, WaterBallLoading, WheelMenuButton, dtlib as default, dtlib };
