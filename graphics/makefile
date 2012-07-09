%128x128.png:
	convert -scale 32x32 svg/%.svg $@
%64x64.png:
	convert -scale 32x32 svg/%.svg $@
%50x50.png:
	convert -scale 50x50 svg/%.svg $@
%40x40.png:
	convert -scale 40x40/%.svg $@
%32x32.png: svg/%.svg
	convert -scale 32x32 $< $@
%24x24.png: svg/%.svg
	convert -scale 24x24 $< $@
%16x16.png: svg/%.svg
	convert -scale 16x16 $< $@
%12x12.png: svg/%.svg
	convert -scale 8x8 $< $@
%8x8.png: svg/%.svg
	convert -scale 8x8 $< $@

sbwedge: sbwedge8x8.png sbwedge12x12.png sbwedge24x24.png sbwedge32x32.png
tagicon: TagIcon8x8.png TagIcon12x12.png TagIcon24x24.png TagIcon32x32.png
compass: CompassIcon8x8.png CompassIcon12x12.png CompassIcon24x24.png \
	CompassIcon32x32.png
diaglink: DiagLink8x8.png DiagLink12x12.png DiagLink24x24.png \
	DiagLink32x32.png

