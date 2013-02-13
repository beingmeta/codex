/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/layout.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements the layout component of Codex, relying heavily
   on CodexLayout from the FDJT library.

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

/* Reporting progress, debugging */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
var Codex=((typeof Codex !== "undefined")?(Codex):({}));
var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.Paginate=
    (function(){

        var fdjtString=fdjt.String;
        var fdjtState=fdjt.State;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtKB=fdjt.KB, fdjtID=fdjt.ID;
        var CodexLayout=fdjt.CodexLayout;

        var getGeometry=fdjtDOM.getGeometry;
        var getParent=fdjtDOM.getParent;
        var getChildren=fdjtDOM.getChildren;
        var hasClass=fdjtDOM.hasClass;
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var TOA=fdjtDOM.toArray;
        var textWidth=fdjtDOM.textWidth;
        var hasText=fdjtDOM.hasText;
        var isEmpty=fdjtString.isEmpty;
        var secs2short=fdjtTime.secs2short;
        var rootloop_skip=50;
        
        var atoi=parseInt;

        function Paginate(why,init){
            if (((Codex.layout)&&(!(Codex.layout.done)))) return;
            if (!(why)) why="because";
            dropClass(document.body,"cxSCROLL");
            addClass(document.body,"cxLAYOUT");
            var forced=((init)&&(init.forced));
            var height=getGeometry(fdjtID("CODEXPAGE")).height;
            var width=getGeometry(fdjtID("CODEXPAGE")).width;
            var bodysize=Codex.bodysize||"normal";
            var bodyfamily=Codex.bodyfamily||"serif";
            if (Codex.layout) {
                var current=Codex.layout;
                if ((!(forced))&&
                    (width===current.page_width)&&
                    (height===current.page_height)&&
                    (bodysize===current.bodysize)&&
                    (bodyfamily===current.bodyfamily)) {
                    fdjtLog("Skipping redundant pagination %j",current);
                    return;}
                // Repaginating, start with reversion
                Codex.layout.Revert();
                Codex.layout=false;}

            // Create a new layout
            var layout=new CodexLayout(getLayoutArgs());
            layout.bodysize=bodysize; layout.bodyfamily=bodyfamily;
            Codex.layout=layout;
            
            var layout_id=layout.layout_id;

            // Get the document info
            var docinfo=Codex.docinfo;

            function saved_layout(content){
                fdjtLog("Using saved layout %s",layout_id);
                fdjtID("CODEXCONTENT").style.display='none';
                dropClass(document.body,"cxSCROLL");
                addClass(document.body,"cxBYPAGE");
                layout.restoreLayout(content);
                getPageTops(layout.pages);
                fdjtID("CODEXPAGE").style.visibility='';
                fdjtID("CODEXCONTENT").style.visibility='';
                dropClass(document.body,"cxLAYOUT");
                Codex.layout=layout;
                Codex.pagecount=layout.pages.length;
                var lostids=layout.lostids, moved_ids=lostids._all_ids;
                var i=0, lim=moved_ids.length;
                while (i<lim) {
                    var addGlossmark=Codex.UI.addGlossmark
                    var id=moved_ids[i++];
                    var glosses=Codex.glosses.find('frag',id);
                    if (!((glosses)&&(glosses.length))) continue;
                    var j=0, jlim=glosses.length; while (j<jlim) {
                        var gloss=Codex.glosses.probe(glosses[j++]);
                        if (gloss) {
                            var nodes=Codex.getDups(gloss.frag);
                            addClass(nodes,"glossed");
                            var k=0, klim=nodes.length; while (k<klim) {
                                addGlossmark(nodes[k++],gloss);}}}}
                setupPageInfo();
                if (Codex.layoutdone) {
                    var fn=Codex.layoutdone;
                    Codex.layoutdone=false;
                    fn();}
                Codex.GoTo(
                    Codex.location||Codex.target||
                        Codex.cover||Codex.titlepage||
                        fdjtID("CODEXPAGE1"),
                    "endLayout",false,false);
                Codex.layout.running=false;

                return false;}
            
            function new_layout(){
                // Prepare to do the layout
                dropClass(document.body,"cxSCROLL");
                addClass(document.body,"cxBYPAGE");
                fdjtID("CODEXPAGE").style.visibility='hidden';
                fdjtID("CODEXCONTENT").style.visibility='hidden';
                
                // Now make the content (temporarily) the same width as
                // the page
                var saved_width=Codex.content.style.width;
                Codex.content.style.width=getGeometry(Codex.page).width+"px";
                
                // Now walk the content
                var content=Codex.content;
                var nodes=TOA(content.childNodes);
                fdjtLog("Laying out %d root nodes into %dx%d pages (%s)",
                        nodes.length,layout.width,layout.height,
                        (why||""));
                
                // Do the adjust font bit.  We rely on Codex.content
                //  having the same width as Codex.page
                fdjt.DOM.adjustFonts(content);
                
                // Now reset the width
                Codex.content.style.width=saved_width;
                
                /* Lay out the coverpage */
                var coverpage=Codex.getCover();
                if (coverpage) layout.addContent(coverpage);
                

                var i=0; var lim=nodes.length;
                function rootloop(){
                    if (i>=lim) {
                        layout.Finish();
                        layout_progress(layout);
                        if (Codex.cachelayouts) {
                            var elapsed=layout.done-layout.started;
                            if (elapsed>(Codex.layoutcachethresh||5000)) {
                                layout.saveLayout();}}
                        var pages=layout.pages;
                        getPageTops(layout.pages);
                        fdjtID("CODEXPAGE").style.visibility='';
                        fdjtID("CODEXCONTENT").style.visibility='';
                        dropClass(document.body,"cxLAYOUT");
                        Codex.layout=layout;
                        Codex.pagecount=layout.pages.length;
                        setupPageInfo();
                        if (Codex.layoutdone) {
                            var fn=Codex.layoutdone;
                            Codex.layoutdone=false;
                            fn();}
                        Codex.GoTo(
                            Codex.location||Codex.target||
                                Codex.cover||Codex.titlepage||
                                fdjtID("CODEXPAGE1"),
                            "endLayout",false,false);
                        Codex.layout.running=false;
                        return false;}
                    else {
                        var root=nodes[i++];
                        var timeslice=layout.timeslice||CodexLayout.timeslice||200;
                        var timeskip=layout.timeskip||CodexLayout.timeskip||50;
                        if (((root.nodeType===3)&&(!(isEmpty(root.nodeValue))))||
                            ((root.nodeType===1)&&
                             (root.tagName!=='LINK')&&(root.tagName!=='META')&&
                             (root.tagName!=='SCRIPT')&&(root.tagName!=='BASE'))) 
                            layout.addContent(root,timeslice,timeskip,
                                              layout.tracelevel,
                                              layout_progress,rootloop);
                        else return rootloop();}}

                /* Reporting progress, debugging */
                
                function layout_progress(info){
                    var tracelevel=info.tracelevel;
                    var started=info.started;
                    var pagenum=info.pagenum;
                    var now=fdjtTime();
                    if (!(pagenum)) return;
                    if (info.done) {
                        LayoutMessage(fdjtString(
                            "Finished laying out %d %dx%d pages in %s",
                            pagenum,
                            secs2short((info.done-info.started)/1000)));
                        fdjtLog("Finished laying out %d %dx%d pages in %s",
                                pagenum,info.width,info.height,
                                secs2short((info.done-info.started)/1000));}
                    else {
                        if ((info.lastid)&&(Codex.docinfo)&&
                            ((Codex.docinfo[info.lastid]))) {
                            var docinfo=Codex.docinfo;
                            var maxloc=docinfo._maxloc;
                            var lastloc=docinfo[info.lastid].starts_at;
                            var pct=(100*lastloc)/maxloc;
                            fdjtUI.ProgressBar.setProgress("CODEXLAYOUTMESSAGE",pct);
                            LayoutMessage(fdjtString(
                                "Laid out %d pages (%d%%) in %s",
                                pagenum,Math.floor(pct),
                                secs2short((now-started)/1000)));
                            if (tracelevel)
                                fdjtLog("Laid out %d pages (%d%%) in %s",
                                        pagenum,Math.floor(pct),
                                        secs2short((now-started)/1000));}
                        else {
                            LayoutMessage(fdjtString(
                                "Laid out %d pages in %s",
                                info.pagenum,secs2short((now-started)/1000)));
                            if (tracelevel)
                                fdjtLog("Laid out %d pages in %s",
                                        info.pagenum,secs2short((now-started)/1000));}}}
                
                function LayoutMessage(msg){
                    fdjtUI.ProgressBar.setMessage("CODEXLAYOUTMESSAGE",msg);}
                
                rootloop();}

            function getPageTop(node) {
                if (hasClass(node,"codexpage")) {}
                else if ((node.id)&&(docinfo[node.id])) {
                    if (hasText(node)) return node;}
                else if ((node.codexbaseid)&&(docinfo[node.codexbaseid])) {
                    if (hasText(node)) return node;}
                else {}
                var children=node.childNodes;
                if (children) {
                    var i=0; var lim=children.length;
                    while (i<lim) {
                        var child=children[i++];
                        if (child.nodeType===1) {
                            var first=getPageTop(child);
                            if (first) return first;}}}
                return false;}
            
            function getDupNode(under,id){
                var children;
                if (under.nodeType!==1) return false;
                else if (under.codexbaseid===id) return under;
                if (!(children=under.childNodes))
                    return false;
                else if (!(children.length)) return false;
                else {
                    var i=0, lim=children.length;
                    while (i<lim) {
                        var found=getDupNode(children[i++],id);
                        if (found) return found;}}}

            function getLocOff(pages,topstart,topnode){
                var id=topstart.id; var locoff=0;
                var pagescan=topstart, pagenum, elt=topstart;
                while (pagescan) {
                    if (hasClass(pagescan,"codexpage")) {
                        break;}
                    else pagescan=pagescan.parentNode;}
                if (!(pagescan)) return locoff;
                else pagenum=parseInt(pagescan.getAttribute("data-pagenum"));
                while ((elt)&&(elt!==topnode)) {
                    var width=textWidth(elt);
                    if (width) locoff=locoff+width;
                    pagescan=pages[++pagenum];
                    if (pagescan) elt=getDupNode(pagescan,id);}
                return locoff;}
            
            function getPageTops(pages){
                var j=0, jlim=pages.length, running=0;
                while (j<jlim) {
                    var page=pages[j++];
                    var topnode=getPageTop(page);
                    if (topnode) {
                        var topstart=document.getElementById(
                            topnode.codexbaseid||topnode.id);
                        var locoff=((topstart===topnode)?(0):
                                    (getLocOff(pages,topstart,topnode)));
                        var id=topstart.id; var info=docinfo[id];
                        page.setAttribute("data-topid",id);
                        page.setAttribute(
                            "data-sbookloc",info.starts_at+locoff);
                        running=info.starts_at+locoff;}
                    else {
                        page.setAttribute("data-sbookloc",running);}}}


            CodexLayout.fetchLayout(layout_id,function(content){
                if (content)
                    saved_layout(content);
                else new_layout();});}
        Codex.Paginate=Paginate;

        CodexLayout.prototype.onresize=function(evt){
            var content=Codex.content; var page=Codex.page;
            var page_width=fdjtDOM.getGeometry(page).width;
            var content_width=fdjtDOM.getGeometry(content).width;
            var view_width=fdjtDOM.viewWidth();
            var view_height=fdjtDOM.viewHeight();
            var page_margin=(view_width-page_width)/2;
            var content_margin=(view_width-content_width)/2;
            if (page_margin!==50) {
                page.style.left=page_margin+'px';
                page.style.right=page_margin+'px';}
            else page.style.left=page.style.right='';
            if (content_margin!==50) {
                content.style.left=content_margin+'px';
                content.style.right=content_margin+'px';}
            else content.style.left=content.style.right='';
            fdjtID("CODEXHEART").style.maxHeight=(view_height-100)+'px';
            if (Codex.bypage) Codex.Paginate("resize");
            else fdjt.DOM.adjustFonts(Codex.content);
            fdjt.DOM.adjustFonts(Codex.HUD);};
        
        Codex.addConfig(
            "layout",
            function(name,val){
                Codex.page_style=val;
                if (val==='bypage') {
                    if (!(Codex.docinfo)) {
                        // If there isn't any docinfo (during startup, for
                        // instance), don't bother actually paginating.
                        Codex.bypage=true;}
                    else if (!(Codex.bypage)) {
                        // set this
                        Codex.bypage=true;
                        if (Codex.postconfig)
                            // If we're in the middle of config,
                            // push off the work of paginating
                            Codex.postconfig.push(Paginate);
                        // Otherwise, paginate away
                        else Codex.Paginate("config");}}
                else {
                    // If you've already paginated, revert
                    if (Codex.layout) {
                        Codex.layout.Revert();
                        Codex.layout=false;}
                    else if (((Codex.layout)&&(!(Codex.layout.done)))) {
                        if (Codex.layout.timer) {
                            clearTimeout(Codex.layout.timer);
                            Codex.layout.timer=false;}
                        Codex.layout.Revert();
                        Codex.layout=false;}
                    Codex.bypage=false;
                    if (Codex.layout) {
                        Codex.layout.Revert();
                        Codex.layout=false;}
                    dropClass(document.body,"cxBYPAGE");
                    addClass(document.body,"cxSCROLL");
                    fdjt.DOM.adjustFonts(Codex.content);}});

        function updateLayoutProperty(name,val){
            // This updates layout properties
            fdjtDOM.swapClass(
                Codex.page,new RegExp("codex"+name+"\w*"),"codex"+name+val);
            Codex[name]=val;
            if (Codex.layout) {
                // If you're already paginated, repaginate.  Either
                // when done with the config or immediately.
                if (Codex.postconfig) {
                    Codex.postconfig.push(function(){
                        // Codex.setMode(true);
                        Codex.Paginate(name);});}
                else {
                    // Codex.setMode(true);
                    Codex.Paginate(name);}}}
        Codex.addConfig("bodysize",updateLayoutProperty);
        Codex.addConfig("bodyfamily",updateLayoutProperty);
        
        function getLayoutArgs(){
            var height=getGeometry(fdjtID("CODEXPAGE"),false,true).inner_height;
            var width=getGeometry(fdjtID("CODEXPAGE"),false,true).width;
            var container=fdjtDOM("div.codexpages#CODEXPAGES");
            var bodysize=Codex.bodysize||"normal";
            var bodyfamily=Codex.bodyfamily||"serif";
            var pagerule=fdjtDOM.addCSSRule(
                "div.codexpage",
                "width: "+width+"px; "+"height: "+height+"px;");
            var layout_id=fdjtString(
                "%dx%d-%s-%s(%s)",
                width,height,bodysize,bodyfamily,
                // Layout depends on the actual file ID, if we've got
                // one, rather than just the REFURI
                Codex.sourceid||Codex.refuri);
            
            var args={page_height: height,page_width: width,
                      container: container,pagerule: pagerule,
                      tracelevel: Codex.Trace.layout,
                      layout_id: layout_id,
                      logfn: fdjtLog};
            fdjtDOM.replace("CODEXPAGES",container);
            Codex.pages=container;
            
            var avoidbreakclasses=
                /\b(sbookfullpage)|(sbooktitlepage)|(stanza)\b/;
            var avoidbreakinside=
                fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakinside",true));
            if (avoidbreakinside) args.avoidbreakinside=
                [avoidbreakclasses,avoidbreakinside];
            else args.avoidbreakinside=avoidbreakclasses;

            var abb=fdjtDOM.getMeta("alwaysbreakbefore",true);
            var fbb=fdjtDOM.getMeta("forcebreakbefore",true);
            var forcebreakbefore=fdjtDOM.sel(abb.concat(fbb));
            if (forcebreakbefore) args.forcebreakbefore=forcebreakbefore;

            var aba=fdjtDOM.getMeta("alwaysbreakafter",true);
            var fba=fdjtDOM.getMeta("forcebreakafter",true);
            var forcebreakafter=fdjtDOM.sel(aba.concat(fba));
            if (forcebreakafter) args.forcebreakafter=forcebreakafter;

            var avoidbreakafter=
                fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakafter",true));
            if (avoidbreakafter) args.avoidbreakafter=avoidbreakafter;

            var avoidbreakbefore=
                fdjtDOM.sel(fdjtDOM.getMeta("avoidbreakbefore",true));
            if (avoidbreakbefore) args.avoidbreakbefore=avoidbreakbefore;
            
            var fullpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfullpage",true));
            if (fullpages) fullpages.concat([".sbookfullpage",".sbooktitlepage",".sbookpage"]);
            else fullpages=[".sbookfullpage",".sbooktitlepage",".sbookpage"];
            args.fullpages=fullpages;
            
            var floatpages=fdjtDOM.sel(fdjtDOM.getMeta("sbookfloatpage",true));
            if (floatpages) floatpages.push("sbookfloatpage");
            else floatpages=[".sbookfloatpage"];
            args.floatpages=floatpages;

            var scaletopage=fdjtDOM.getMeta("sbookscaletopage",true);;
            if ((scaletopage)&&(scaletopage.length)) 
                scaletopage.concat([".sbookscaletopage",".sbookpagescaled"]);
            else scaletopage=[".sbookscaletopage",".sbookpagescaled"];
            args.scaletopage=scaletopage=scaletopage;
            
            if ((fdjtDOM.getMeta("Codex.dontbreakblocks"))||
                (fdjtDOM.getMeta("Codex.keepblocks"))||
                (fdjtDOM.getMeta("~=Codex.dontbreakblocks"))||
                (fdjtDOM.getMeta("~=Codex.keepblocks"))||
                (fdjtDOM.getMeta("~dontbreakblocks"))||
                (fdjtDOM.getMeta("~keepblocks")))
                args.break_blocks=false;
            else args.break_blocks=true;
            
            if ((fdjtDOM.getMeta("Codex.dontscalepages"))||
                (fdjtDOM.getMeta("~=Codex.dontscalepages"))||
                (fdjtDOM.getMeta("dontscalepages")))
                args.scale_pages=false;
            else args.scale_pages=true;

            args.dontsave=fdjt.DOM.Selector(".codexglossmark");
            
            return args;}
        CodexLayout.getLayoutArgs=getLayoutArgs;

        /* Updating the page display */

        function updatePageDisplay(pagenum,location,classname) {
            if (!(classname)) classname="current";
            var npages=Codex.pagecount;
            var book_len=Codex.ends_at;
            var page_elt=fdjt.ID("CODEXPAGESPAN"+pagenum);
            var cur=getChildren("CODEXPAGEINFO","."+classname);
            if (cur[0]!==page_elt) {
                dropClass(cur,classname);
                addClass(page_elt,classname);}
            var locoff;
            if (typeof location==='number') {
                var max_loc=Codex.ends_at;
                var pct=(100*location)/max_loc;
                // This is (very roughly) intended to be the precision needed
                //  for line level (40 character) accuracy.
                var prec=Math.round(Math.log(max_loc/40)/Math.log(10))-2;
                if (prec<0) prec=0;
                locoff=fdjtDOM(
                    "span.locoff#CODEXLOCOFF",
                    fdjtString.precString(pct,prec)+"%");
                locoff.title=location+"/"+max_loc;}
            else locoff=fdjtDOM("span.locoff#CODEXLOCOFF");
            var pageno_text=fdjtDOM(
                "span#CODEXPAGENOTEXT.pageno",pagenum,"/",npages);
            fdjtDOM.replace("CODEXPAGENOTEXT",pageno_text);
            fdjtDOM.replace("CODEXLOCOFF",locoff);
            locoff.title=
                ((locoff.title)||"")+
                ((locoff.title)?("; "):(""))+
                "click to jump to a percentage location in the book";
            fdjtDOM.addListeners(
                locoff,Codex.UI.handlers[Codex.ui]["#CODEXLOCOFF"]);
            pageno_text.title="click to jump to a particular page";
            fdjtDOM.addListeners(
                pageno_text,Codex.UI.handlers[Codex.ui]["#CODEXPAGENOTEXT"]);}
        Codex.updatePageDisplay=updatePageDisplay;
        
        /* Page info */
        
        function setupPageInfo(){
            var i=0, n=Codex.pagecount; var html=[];
            var spanwidth=
                (fdjtID("CODEXPAGEINFO").offsetWidth)/n;
            if (spanwidth<1) spanwidth=1;
            var pagespanrule=fdjtDOM.addCSSRule(
                "div.pagespans > span","width: "+spanwidth+"px;");
            while (i<n) {
                html.push("<span id='CODEXPAGESPAN"+(i+1)+"' "+
                          "title='p"+(i+1)+". Hold to glimpse, tap to jump' "+
                          "style='left: "+(100*(i/n))+"%'"+
                          ">"+(i+1)+"</span>");
                i++;}
            var spans=fdjtID("CODEXPAGESPANS");
            spans.innerHTML=html.join("");
            var outer_width=getGeometry(spans);
            var inner_width=fdjt.DOM.getInsideBounds(spans);
            var tweak=outer_width/inner_width;
            spans.style[fdjt.DOM.transform]="scale("+tweak+",1)";}
        Codex.setupPageInfo=setupPageInfo;
        
        /* Movement by pages */
        
        var curpage=false;
        
        function GoToPage(spec,caller,pushstate){
            if (typeof pushstate === 'undefined') pushstate=true;
            if (Codex.previewing) stopPreview("GoToPage");
            dropClass(document.body,"codexhelp");
            if (Codex.layout) {
                var page=Codex.layout.getPage(spec)||
                    Codex.layout.getPage(1);
                var pagenum=parseInt(page.getAttribute("data-pagenum"));
                if (Codex.Trace.flips)
                    fdjtLog("GoToPage/%s Flipping to %o (%d) for %o",
                            caller,page,pagenum,spec);
                if (curpage) {
                    dropClass(curpage,"nextpage");
                    addClass(curpage,"lastpage");
                    dropClass(curpage,"curpage");}
                addClass(page,"nextpage");
                addClass(page,"curpage");
                var lastpage=curpage, nextpage=page;
                setTimeout(function(){
                    dropClass(lastpage,"lastpage");
                    dropClass(nextpage,"nextpage");},
                           300);
                if (typeof spec === 'number') {
                    var location=parseInt(page.getAttribute("data-sbookloc"));
                    Codex.setLocation(location);}
                updatePageDisplay(pagenum,Codex.location);
                curpage=page; Codex.curpage=pagenum;
                if (pushstate) {
                    var curnode=fdjtID(page.getAttribute("data-topid"));
                    Codex.point=curnode;
                    Codex.setHead(curnode);}
                if ((pushstate)&&(page)) {
                    Codex.setState(
                        {location: atoi(page.getAttribute("data-sbookloc")),
                         page: atoi(page.getAttribute("data-pagenum")),
                         target: Codex.target.id});}
                var glossed=fdjtDOM.$(".glossed",page);
                if (glossed) {
                    var addGlossmark=Codex.UI.addGlossmark;
                    var i=0; var lim=glossed.length;
                    while (i<lim) addGlossmark(glossed[i++]);}}}
        Codex.GoToPage=GoToPage;
        

        /** Previewing **/

        var previewing=false;
        function startPreview(spec,caller){
            var page=((spec.nodeType)&&(getParent(spec,".codexpage")))||
                Codex.layout.getPage(spec)||
                Codex.layout.getPage(1);
            var pagenum=parseInt(page.getAttribute("data-pagenum"));
            var pageloc=parseInt(page.getAttribute("data-sbookloc"));
            if (previewing===page) return;
            if (previewing) dropClass(previewing,"previewpage");
            dropClass(getChildren(Codex.pages,".previewpage"),
                      "previewpage");
            if (Codex.Trace.flips)
                fdjtLog("startPagePreview/%s to %o (%d) for %o",
                        caller||"nocaller",page,pagenum,spec);
            if (curpage) addClass(curpage,"hidepage");
            // Using this timeout here avoids some glitches
            addClass(page,"previewpage");
            Codex.previewing=previewing=page;
            addClass(document.body,"cxPREVIEW");
            updatePageDisplay(pagenum,pageloc,"preview");}
        function stopPreview(caller){
            var pagenum=parseInt(curpage.getAttribute("data-pagenum"));
            if (Codex.Trace.flips)
                fdjtLog("stopPagePreview/%s from %o to %o (%d)",
                        caller||"nocaller",previewing,curpage,pagenum);
            var newpage=false;
            if (!(previewing)) return;
            dropClass(previewing,"previewpage");
            dropClass(curpage,"hidepage");
            dropClass(getChildren(Codex.pages,".previewpage"),
                      "previewpage");
            Codex.previewing=previewing=false;
            dropClass(document.body,"cxPREVIEW");
            updatePageDisplay(pagenum,Codex.location,"current");
            if (typeof newpage === "number") Codex.GoToPage(newpage);}
        Codex.startPagePreview=startPreview;
        Codex.stopPagePreview=stopPreview;

        function getPage(arg){
            if (!(Codex.layout)) return -1;
            var node=((arg.nodeType)?(arg):
                      (typeof arg === "string")?
                      (fdjtID(arg)):(false));
            var page=Codex.layout.getPage(arg)||Codex.layout.getPage(1);
            return parseInt(page.getAttribute("data-pagenum"));}
        Codex.getPage=getPage;
        
        function displaySync(){
            if ((Codex.pagecount)&&(Codex.curpage))
                Codex.GoToPage(Codex.curpage,"displaySync");}
        Codex.displaySync=displaySync;

        // We handle this ourselves
        fdjt.UI.adjustFont.onresize=false;

        return Paginate;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
