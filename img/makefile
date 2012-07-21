%128x128.png: ../svg/%.svg
	convert -background transparent -scale 128x128 $< $@
%128x128.gif: ../svg/%.svg
	convert -background transparent -scale 128x128 $< $@
%64x64.png: ../svg/%.svg
	convert -background transparent -scale 64x64 $< $@
%64x64.gif: ../svg/%.svg
	convert -background transparent -scale 64x64 $< $@
%50x50.png: ../svg/%.svg
	convert -background transparent -scale 50x50 $< $@
%50x50.gif: ../svg/%.svg
	convert -background transparent -scale 50x50 $< $@
%40x40.png: ../svg/%.svg
	convert -background transparent -scale 40x40 $< $@
%40x40.gif: ../svg/%.svg
	convert -background transparent -scale 40x40 $< $@
%32x32.png: ../svg/%.svg
	convert -background transparent -scale 32x32 $< $@
%32x32.gif: ../svg/%.svg
	convert -background transparent -scale 32x32 $< $@
%24x24.png: ../svg/%.svg
	convert -background transparent -scale 24x24 $< $@
%24x24.gif: ../svg/%.svg
	convert -background transparent -scale 24x24 $< $@
%16x16.png: ../svg/%.svg
	convert -background transparent -scale 16x16 $< $@
%16x16.gif: ../svg/%.svg
	convert -background transparent -scale 16x16 $< $@
%12x12.png: ../svg/%.svg
	convert -background transparent -scale 8x8 $< $@
%12x12.gif: ../svg/%.svg
	convert -background transparent -scale 8x8 $< $@
%8x8.png: ../svg/%.svg
	convert -background transparent -scale 8x8 $< $@
%8x8.gif: ../svg/%.svg
	convert -background transparent -scale 8x8 $< $@
%Tab.png: ../svg/%Tab.svg
	convert -background transparent -scale 39x50 $< $@

all: addglossicons scanicons tagicons diaglinks hudbuttons tabs misc

addglossicons: remark_add64x64.png remark_edit64x64.png \
	remark_share64x64.png  remark_tag64x64.png remark_link64x64.png \
	remark_text64x64.png remark24x24.png remark32x32.png \
	remark_respond32x32.png remark_respond64x64.png
scanicons: ScanLeft16x16.png ScanLeftStop16x16.png \
	ScanRight16x16.png ScanRightStop16x16.png \
	ScanLeft32x32.png ScanLeftStop32x32.png \
	ScanRight32x32.png ScanRightStop32x32.png \
	ScanLeft64x64.png ScanLeftStop64x64.png \
	ScanRight64x64.png ScanRightStop64x64.png
tagicons: TagIcon16x16.png TagIcon24x24.png TagIcon32x32.png  \
	TagIcon50x50.png TagIcon64x64.png TagIcon128x128.png 
diaglinks: DiagLink8x8.png DiagLink12x12.png DiagLink16x16.png \
	DiagLink24x24.png DiagLink32x32.png DiagLink40x40.png \
	DiagLink50x50.png DiagLink64x64.png DiagLink8x8.gif \
	DiagLink12x12.gif DiagLink16x16.gif DiagLink24x24.gif \
	DiagLink32x32.gif DiagLink40x40.gif DiagLink50x50.gif \
	DiagLink64x64.gif
hudbuttons: CompassIcon32x32.png CompassIcon50x50.png \
	AllGlosses32x32.png AllGlosses50x50.png \
	TagSearch32x32.png TagSearch50x50.png \
	HelpIcon32x32.png HelpIcon50x50.png
tabs: AboutTab.png TOCTab.png LoginTab.png ConsoleTab.png OverlaysTab.png \
	SettingsTab.png

misc: redx32x32.png outlink32x32.png \
	sbwedge32x32.png sbwedge64x64.png \
	twistyclosed32x32.png twistyopen32x32.png \
	sbookspeople24x24.png sbookspeople50x50.png

