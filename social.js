/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/social.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements basic features for browsing glosses based on
   their "sources" --- the reasons they're overlaid on the reader's
   book in the first place.

   This file is part of Codex, a Javascript/DHTML web application for reading
   large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

    Use and redistribution (especially embedding in other
      CC licensed content) is permitted under the terms of the
      Creative Commons "Attribution-NonCommercial" license:

          http://creativecommons.org/licenses/by-nc/3.0/ 

    Other uses may be allowed based on prior agreement with
      beingmeta, inc.  Inquiries can be addressed to:

       licensing@beingmeta.com

   Enjoy!

*/

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
var Codex=((typeof Codex !== "undefined")?(Codex):({}));
var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

(function(){

    var fdjtString=fdjt.String;
    var fdjtState=fdjt.State;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var fdjtKB=fdjt.KB, fdjtID=fdjt.ID;

    var sbook_sources=false;
    var sbook_glosses_target=false;
    var sbookGlossesHUD=false;
    var sbookSourceHUD=false;

    // The highlighted glossmark
    var sbook_glossmark=false;
    var sbook_glossmark_qricons=false;

    var hasClass=fdjtDOM.hasClass;
    var addClass=fdjtDOM.addClass;
    var dropClass=fdjtDOM.dropClass;
    var cxicon=Codex.icon;

    /* Social UI components */

    function addSource(info,withgloss){
        if (typeof info === 'string') info=fdjtKB.ref(info);
        var humid=info.humid;
        if (!(info.name)) return;
        if (withgloss) {
            var icon=fdjtID("SBOOKSOURCEICON"+humid);
            if (!(icon)) { // Add icon to the sources bar
                var pic=(info.pic)||
                    ((info.fbid)&&
                     ("https://graph.facebook.com/"+info.fbid+
                      "/picture?type=square"));
                if ((pic)&&(window.applicationCache)) {
                    var cache=window.applicationCache;
                    if (cache.add) cache.add(pic);
                    // This gets an "operation is insecure error.
                    else if (cache.mozAdd) {} // cache.mozAdd(pic);
                    // We could probably use local storage to handle this
                    // case, but that would be hairy.
                    else {}}
                var kind=info.kind;
                if (pic) {}
                else if (kind===':CIRCLE')
                    pic=cxicon("readingcircle",64,64);
                else if (kind===':OVERDOC')
                    pic=cxicon("sideguide",64,64);
                else {}
                if (pic)
                  icon=fdjtDOM.Image
                    (pic,".button.source",info.name|info.kind,
                     ("click to show/hide glosses from "+info.name));
                else {
                  icon=fdjtDOM("div.button.source",
                               fdjtString.getInitials(info.name));}
                var title=
                    ((kind===':CIRCLE')?("the reading circle "):
                     (kind===':OVERDOC')?("the reading guide "):
                     ("the overlay "))+
                    ((info.name)?("“"+(info.name)+"”"):"")+
                    ((info.about)?": ":"")+
                    ((info.about)?(info.about):"");
                icon.title=title; icon.oid=info._id;
                icon.id="SBOOKSOURCEICON"+humid;
                fdjtDOM(fdjtID("CODEXSOURCES")," ",icon);}}
        return info;};
    Codex.UI.addSource=addSource;
    Codex.UI.addGlossSource=function(info){addSource(info,true);};

    function everyone_ontap(evt){
        evt=evt||event||null;
        var target=fdjtDOM.T(evt);
        // var sources=fdjtDOM.getParent(target,".codexsources");
        // var glosses=fdjtDOM.getParent(target,".sbookglosses");
        var sources=fdjtID("CODEXSOURCES");
        var glosses=fdjtID("CODEXALLGLOSSES");
        var new_sources=[];
        if ((!(sources))||(!(glosses)))
            return; /* Warning? */
        if (fdjtDOM.hasClass(target,"selected")) {
            Codex.setMode(false);
            fdjtDOM.cancel(evt);
            return;}
        var selected=fdjtDOM.$(".selected",sources);
        fdjtLog("Everyone click sources=%o glosses=%o selected=%o/%d",
                sources,glosses,selected,selected.length);
        fdjtDOM.toggleClass(selected,"selected");
        fdjtDOM.addClass(target,"selected");
        Codex.UI.selectSources(glosses,false);
        fdjtDOM.cancel(evt);}
    Codex.UI.handlers.everyone_ontap=everyone_ontap;

    function sources_ontap(evt){
        evt=evt||event||null;
        // if (!(Codex.user)) return;
        var target=fdjtDOM.T(evt);
        // var sources=fdjtDOM.getParent(target,".codexsources");
        // var glosses=fdjtDOM.getParent(target,".sbookglosses");
        var sources=fdjtID("CODEXSOURCES");
        var glosses=fdjtID("CODEXALLGLOSSES");
        var new_sources=[];
        if ((!(sources))||(!(glosses))||(!(target.oid)))
            return; /* Warning? */
        if ((evt.shiftKey)||(fdjtDOM.hasClass(target,"selected"))) {
            fdjtDOM.toggleClass(target,"selected");
            var selected=fdjtDOM.$(".selected",sources);
            var i=0; var len=selected.length;
            while (i<len) {
                var oid=selected[i++].oid;
                if (oid) new_sources.push(oid);}}
        else {
            var selected=fdjtDOM.$(".selected",sources);
            var i=0; var len=selected.length;
            while (i<len) fdjtDOM.dropClass(selected[i++],"selected");
            fdjtDOM.addClass(target,"selected");
            new_sources=[target.oid];}
        var everyone=fdjtDOM.$(".everyone",sources)[0];
        if (new_sources.length) {
            if (everyone) fdjtDOM.dropClass(everyone,"selected");
            Codex.UI.selectSources(glosses,new_sources);}
        else {
            if (everyone) fdjtDOM.addClass(everyone,"selected");
            Codex.UI.selectSources(glosses,false);}
        fdjtDOM.cancel(evt);}
    Codex.UI.handlers.sources_ontap=sources_ontap;

    function geticon(source){
        return ((source.pic)||(source.fb_pic)||
                (source.twitter_pic)||(source.gplus_pic)||
                ((source.fbid)&&
                 ("https://graph.facebook.com/"+
                  source.fbid+"/picture?type=square")));}

    function extendGlossmark(glossmark,glosses,bigimage){
        var Sources=Codex.sourcekb; var Glosses=Codex.glosses;
        if (!(bigimage)) bigimage=fdjtDOM.getChild(glossmark,".big");
        var images=bigimage.getAttribute("data-images").split(";");
        if ((images.length===1)&&(images[0]==="")) images=[];
        var i=0; var lim=glosses.length;
        while (i<lim) {
            var gloss=Glosses.ref(glosses[i++]);
            var maker=((gloss.maker)&&(Sources.ref(gloss.maker)));
            var maker_img=((maker)&&geticon(maker));
            if (maker_img) images.push(maker_img);
            var outlets=gloss.sources||[];
            if (typeof outlets === 'string') outlets=[outlets];
            var j=0, jlim=outlets.length; while (j<jlim) {
                var outlet=Sources.ref(outlets[j++]);
                var outlet_img=geticon(outlet);
                if (outlet_img) images.push(outlet_img);}}
        bigimage.setAttribute("data-images",images.join(";"));
        return glossmark;}
    
    Codex.UI.addGlossmark=function(passage,gloss){
        var Glosses=Codex.glosses;
        var glossmark=fdjtDOM.getChild(passage,".codexglossmark");
        if ((glossmark)&&(glossmark.parentNode===passage)) {
            if (gloss) extendGlossmark(glossmark,[gloss]);
            return glossmark;}
        var imgsrc=(cxicon("sbwedge",64,64));
        var bigimage=fdjtDOM.Image(imgsrc,"big","glosses");
        var glossmark=fdjtDOM(
            "span.codexglossmark.fdjtskiptext",
            bigimage,fdjtDOM.Image(cxicon("sbwedge",64,64),"tiny","*"));
        // Get all the glosses from the index
        var glosses=Glosses.index(false,"frag",passage.id);
        glossmark.title=
            ((glosses.length>1)?
             ("See "+glosses.length+" glosses on this passage"):
             ("See the gloss on this passage"));
        bigimage.defaultsrc=imgsrc;
        bigimage.setAttribute("data-images","");
        extendGlossmark(glossmark,glosses,bigimage);
        Codex.UI.addHandlers(glossmark,"glossmark");
        fdjtDOM.addClass(passage,"glossed");
        fdjtDOM.prepend(passage,glossmark);
        return glossmark;};
    
    function showGlosses(target) {
        var glosses=Codex.glosses.find('frag',target.codexbaseid||target.id);
        var sumdiv=fdjtDOM("div.codexglosses.codexslice.hudpanel#CODEXPASSAGEGLOSSES");
        var excerpt=false;
        if ((!(glosses))||(!(glosses.length)))
            fdjtDOM.addClass(sumdiv,"noglosses");
        Codex.UI.setupSummaryDiv(sumdiv);
        if (Codex.target) Codex.clearHighlights(Codex.target);
        if (glosses) {
            var i=0; var n=glosses.length;
            while (i<n) {
                var gloss=fdjtKB.ref(glosses[i++],Codex.glosses);
                if ((!(gloss))||(!(gloss.frag))) continue;
                if ((!excerpt)&&(gloss.excerpt)) excerpt=gloss.excerpt;
                var card=Codex.renderCard(gloss);
                fdjtDOM(sumdiv,card);}}
        fdjtDOM.replace("CODEXPASSAGEGLOSSES",sumdiv);
        Codex.setTarget(target);
        if (excerpt) {
            var range=fdjtDOM.findString(target,excerpt);
            if (range) fdjtUI.Highlight(range,"highlightexcerpt");}
        else addClass(target,"highlightpassage");
        Codex.setMode("glosses");}
    Codex.showGlosses=showGlosses;

})();

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  indent-tabs-mode: nil ***
;;;  End: ***
*/
