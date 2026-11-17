(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('hel-lib-proxy')) :
	typeof define === 'function' && define.amd ? define(['exports', 'hel-lib-proxy'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["comps-vue3"] = {}, global.HelLibProxy));
})(this, (function (exports, helLibProxy) { 'use strict';

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
	const dtlib = helLibProxy.exposeLib(LIB_NAME);
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

	exports.BilibiliBanner = BilibiliBanner;
	exports.BookFlip = BookFlip;
	exports.ChinaRouteMap = ChinaRouteMap;
	exports.CircularMenu = CircularMenu;
	exports.CircularMenuV2 = CircularMenuV2;
	exports.CompareSlider = CompareSlider;
	exports.CorgiInput = CorgiInput;
	exports.CubeWaveLoading = CubeWaveLoading;
	exports.CyberInput = CyberInput;
	exports.DnaLoading = DnaLoading;
	exports.DominoLoading = DominoLoading;
	exports.ExpandSearch = ExpandSearch;
	exports.FilmRoll = FilmRoll;
	exports.FloatingLabelInput = FloatingLabelInput;
	exports.GearLoading = GearLoading;
	exports.GlowBorder = GlowBorder;
	exports.GooeyBallsLoading = GooeyBallsLoading;
	exports.GridLoading = GridLoading;
	exports.HelloWorld = HelloWorld;
	exports.HourglassLoading = HourglassLoading;
	exports.JellyLoading = JellyLoading;
	exports.LiftCard = LiftCard;
	exports.MagneticButton = MagneticButton;
	exports.MinecraftChest = MinecraftChest;
	exports.NeonRingLoading = NeonRingLoading;
	exports.PasswordInput = PasswordInput;
	exports.PhotoSphere = PhotoSphere;
	exports.PosterCollage = PosterCollage;
	exports.RopeGallery = RopeGallery;
	exports.SlideAuthPanel = SlideAuthPanel;
	exports.SplitCodePreview = SplitCodePreview;
	exports.SpotlightButton = SpotlightButton;
	exports.TerminalAuth = TerminalAuth;
	exports.TiltCard = TiltCard;
	exports.Typewriter = Typewriter;
	exports.VortexLoading = VortexLoading;
	exports.WarpStarfield = WarpStarfield;
	exports.WaterBallLoading = WaterBallLoading;
	exports.WheelMenuButton = WheelMenuButton;
	exports.default = dtlib;
	exports.dtlib = dtlib;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
