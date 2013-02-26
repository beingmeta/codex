/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/search.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements the search component for the e-reader web
   application, and relies heavily on the Knodules module.

   This file is part of Codex, a Javascript/DHTML web application for reading
   large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.
   This file assumes that the sbooks.js file has already been loaded.

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
    var RefDB=fdjt.RefDB, Ref=fdjt.Ref, Query=RefDB.Query; 
    var KNode=Knodule.KNode;

    var cloudEntry=Codex.cloudEntry;

    Codex.search_cloud=false;
    if (!(Codex.empty_cloud)) Codex.empty_cloud=false;
    if (!(Codex.show_refiners)) Codex.show_refiners=25;
    if (!(Codex.search_gotlucky)) Codex.search_gotlucky=7;
    
    var cxicon=Codex.icon;

    var Completions=fdjtUI.Completions;
    var addClass=fdjtDOM.addClass;
    var dropClass=fdjtDOM.dropClass;
    var getChildren=fdjtDOM.getChildren;
    var getChild=fdjtDOM.getChild;
    var log=fdjtLog;
    var kbref=RefDB.resolve;

    /* Query functions */

    /* Set on main search input */
    // id="CODEXSEARCHINPUT" 
    // completions="CODEXSEARCHCLOUD"

    Codex.getQuery=function(){return Codex.query;}
    
    function setQuery(query){
        if (Codex.Trace.search) log("Setting working query to %o",query);
        var qstring=query.getString();
        if (qstring!==Codex.qstring) {
            Codex.query=query;
            Codex.qstring=qstring;
            if (query.tags.length===0) 
                addClass(Codex.HUD,"emptysearch");
            else {
                var cloud=Codex.queryCloud(query);
                dropClass(Codex.HUD,"emptysearch");
                fdjtDOM.replace("CODEXSEARCHCLOUD",cloud.dom);}
            useQuery(query,fdjtID("CODEXSEARCH"));}
        if (Codex.mode==="search") {
            if (query.results.length===0) {}
            else if (query.results.length<7)
                showSearchResults();
            else {fdjtID("CODEXSEARCHINPUT").focus();}}}

    Codex.setQuery=setQuery;

    function useQuery(query,box_arg){
        if (query instanceof Query) query=query;
        else query=new Codex.Query(query);
        var qstring=query.getString();
        if ((box_arg)&&(typeof box_arg === 'string'))
            box_arg=document.getElementById(box_arg);
        var box=box_arg||query._box||fdjtID("CODEXSEARCH");
        if ((query.dom)&&(box)&&(box!==query.dom))
            fdjtDOM.replace(box_arg,query.dom);
        box.setAttribute("qstring",qstring);
        query.execute();
        query.getCoTags();
        if (Codex.Trace.search>1)
            log("Setting query for %o to %o: %o/%o (%o)",
                box,query.tags,
                query.results.length,query.cotags.length,
                qstring);
        else if (Codex.Trace.search)
            log("Setting query for %o to %o: %d results/%d refiners (%o)",
                box,query.tags,
                query.results.length,query.cotags.length,
                qstring);
        var input=getChild(box,".searchinput");
        var cloudid=input.getAttribute("completions");
        var resultsid=input.getAttribute("results");
        var infoid=input.getAttribute("info");
        var qtags=getChild(box,".qtags");
        var cloud=((cloudid)&&(fdjtID(cloudid)));
        var results=((resultsid)&&(fdjtID(resultsid)));
        var info=((infoid)&&(fdjtID(infoid)));
        var resultcount=getChild(info,".resultcount");
        var refinecount=getChild(info,".refinecount");
        // Update (clear) the input field
        input.value='';
        var elts=query.tags; var i=0; var lim=elts.length;
        // Update 'notags' class
        if (elts.length) fdjtDOM.dropClass(Codex.HUD,"emptysearch");
        else addClass(Codex.HUD,"emptysearch");
        // Update the query tags
        var newtags=fdjtDOM("span.qtags");
        while (i<lim) {
            var tag=elts[i];
            if (typeof tag === 'string') tag=kbref(tag)||tag;
            if (i>0) fdjtDOM(newtags," \u00B7 ");
            // Handle section references as tags
            if ((typeof tag === "string")&&(tag[0]==="\u00A7")) {
                var showname=tag;
                if (tag.length>20) {
                    var start=tag.indexOf(' ',8);
                    var end=tag.lastIndexOf(' ',showname.length-8);
                    if (start<0) start=8; if (end<0) end=showname.length-8;
                    if (start<(showname.length-end)) {
                        showname=showname.slice(0,start)+" \u2026 "+
                            showname.slice(end);}}
                var span=fdjtDOM("span.completion",
                                 fdjtDOM("span.sectname",showname));
                fdjtDOM(newtags,span);}
            else if (typeof tag === "string")
                fdjtDOM(newtags,fdjtDOM("span.rawterm",tag));
            else fdjtDOM(newtags,tag);
            i++;}
        if (qtags.id) newtags.id=qtags.id;
        fdjtDOM.replace(qtags,newtags);
        // Update the results display
        if (query.results.length) {
            resultcount.innerHTML=query.results.length+
                " result"+((query.results.length===1)?"":"s");
            fdjtDOM.dropClass([box,info],"noresults");}
        else {
            resultcount.innerHTML="no results";
            addClass([box,info],"noresults");}
        // Update the search cloud
        var n_refiners=((query.cotags)&&(query.cotags.length))||0;
        var completions=Codex.queryCloud(query);
        refinecount.innerHTML=n_refiners+
            ((n_refiners===1)?(" co-tag"):(" co-tags"));
        fdjtDOM.dropClass(box,"norefiners");
        if (query.tags.length===0) {
            fdjtDOM.replace(
                "CODEXSEARCHCLOUD",
                fdjtDOM("div.completions.searchcloud#CODEXSEARCHCLOUD"));
            Codex.empty_cloud.complete("");}
        else {
            if (cloudid) completions.id=cloudid;
            if (Codex.Trace.search>1)
                log("Setting search cloud for %o to %o",box,completions.dom);
            cloudid=cloud.id;
            addClass(completions.dom,"hudpanel");
            fdjtDOM.replace(cloud,completions.dom);
            completions.complete("");}
        if (n_refiners===0) {
            addClass(box,"norefiners");
            refinecount.innerHTML="no refiners";}
        query._box=box; box.setAttribute("qstring",qstring);
        Codex.UI.updateScroller(completions.dom);
        return query;}
    Codex.useQuery=useQuery;

    function extendQuery(query,elt){
        var elts=[].concat(query.tags);
        if (typeof elt === 'string') 
            elts.push(kbref(elt)||elt);
        else elts.push(elt);
        return useQuery(new Codex.Query(elts),query._box);}
    Codex.extendQuery=extendQuery;

    Codex.updateQuery=function(input_elt){
        var q=Knodule.Query.string2query(input_elt.value);
        if ((q)!==(Codex.query.tags))
            Codex.setQuery(q,false);};

    function showSearchResults(){
        var results=Codex.query.showResults();
        addClass(results,"hudpanel");
        fdjtDOM.replace("CODEXSEARCHRESULTS",results);
        Codex.setMode("searchresults");
        fdjtID("CODEXSEARCHINPUT").blur();
        fdjtID("CODEXSEARCHRESULTS").focus();
        Codex.UI.updateScroller(fdjtID("CODEXSEARCHRESULTS"));}
    Codex.showSearchResults=showSearchResults;

    /* Call this to search */

    function startSearch(tag){
        setQuery([tag]);
        Codex.setMode("search");}
    Codex.startSearch=startSearch;

    /* Text input handlers */

    var _sbook_searchupdate=false;
    var _sbook_searchupdate_delay=200;
    var Selector=fdjtDOM.Selector;
    
    function searchInput_keyup(evt){
        evt=evt||event||null;
        var ch=evt.charCode||evt.keyCode;
        var target=fdjtDOM.T(evt);
        // fdjtLog("Input %o on %o",evt,target);
        // Clear any pending completion calls
        if ((ch===13)||(ch===13)||(ch===59)||(ch===93)) {
            var qstring=target.value;
            if (fdjtString.isEmpty(qstring)) showSearchResults();
            else {
                var completeinfo=Codex.queryCloud(Codex.query);
                if (completeinfo.timer) {
                    clearTimeout(completeinfo.timer);
                    completeinfo.timer=false;}
                var completions=completeinfo.complete(qstring);
                var completion=(completeinfo.selection)||
                    completeinfo.select(new Selector(".cue"))||
                    completeinfo.select();
                // Signal error?
                if (!(completion)) return;
                var value=completeinfo.getValue(completion);
                setQuery(extendQuery(Codex.query,value));}
            fdjtDOM.cancel(evt);
            if ((Codex.search_gotlucky) && 
                (Codex.query.results.length>0) &&
                (Codex.query.results.length<=Codex.search_gotlucky))
                showSearchResults();
            else {
                /* Handle new info */
                var completeinfo=Codex.queryCloud(Codex.query);
                completeinfo.complete("");}
            return false;}
        else if (ch===9) { /* tab */
            var qstring=target.value;
            var completeinfo=Codex.queryCloud(Codex.query);
            var completions=completeinfo.complete(qstring);
            fdjtUI.cancel(evt);
            if (completions.prefix!==qstring) {
                target.value=completions.prefix;
                fdjtDOM.cancel(evt);
                setTimeout(function(){
                    Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
                           100);
                return;}
            else if (evt.shiftKey) completeinfo.selectPrevious();
            else completeinfo.selectNext();}
        else {
            var completeinfo=Codex.queryCloud(Codex.query);
            completeinfo.docomplete(target);
            setTimeout(function(){
                Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
                       100);}}
    Codex.UI.handlers.search_keyup=searchInput_keyup;

    function searchUpdate(input,cloud){
        if (!(input)) input=fdjtID("CODEXSEARCHINPUT");
        if (!(cloud)) cloud=Codex.queryCloud(Codex.query);
        cloud.complete(input.value);}
    Codex.searchUpdate=searchUpdate;

    function searchInput_focus(evt){
        evt=evt||event||null;
        var input=fdjtDOM.T(evt);
        Codex.setFocus(input);
        sbook_search_focus=true;
        if ((Codex.mode)&&(Codex.mode==='searchresults'))
            Codex.setMode("search");
        searchUpdate(input);}
    Codex.UI.handlers.search_focus=searchInput_focus;

    function searchInput_blur(evt){
        evt=evt||event||null;
        Codex.setFocus(false);
        sbook_search_focus=false;}
    Codex.UI.handlers.search_blur=searchInput_blur;

    function clearSearch(evt){
        var target=fdjtUI.T(evt||event);
        var box=fdjtDOM.getParent(target,".searchbox");
        var input=getChild(box,".searchinput");
        fdjtUI.cancel(evt);
        if (Codex.query.tags.length===0) {
            Codex.setMode(false); return;}
        else setQuery(Codex.empty_query);
        input.focus();}
    Codex.UI.handlers.clearSearch=clearSearch;
    
    Codex.toggleSearch=function(evt){
        evt=evt||event;
        if ((Codex.mode==="search")||
            (Codex.mode==="searchresults"))
            Codex.setMode(false);
        else {
            Codex.setMode("search");
            fdjtID("CODEXSEARCHINPUT").focus();}
        fdjtUI.cancel(evt);};
    
    /* Show search results */

    function makelocrule(target_info,cxtinfo_arg,cxtname){
        var cxtinfo=cxtinfo_arg||Codex.docinfo[(Codex.body||document.body).id];
        if (!(cxtname)) {
            if (cxtinfo_arg) cxtname="into the section";
            else cxtname="into the book";}
        var locrule=fdjtDOM("hr.locrule");
        var cxt_start=cxtinfo.starts_at;
        var cxt_end=cxtinfo.ends_at;
        var cxt_len=cxt_end-cxt_start;
        var target_start=target_info.starts_at-cxt_start;
        var target_len=target_info.ends_at-target_info.starts_at;
        var locstring="~"+Math.ceil(target_len/5)+ " words long ~"+
            Math.ceil((target_start/cxt_len)*100)+"% "+cxtname;
        locrule.setAttribute("about","#"+(target_info.id||target_info.frag));
        locrule.locstring=locstring+".";
        locrule.title=locstring+": click or hold to glimpse";
        locrule.style.width=((target_len/cxt_len)*100)+"%";
        locrule.style.left=((target_start/cxt_len)*100)+"%";
        return locrule;}

    function showResults(query){
        if (query.listing) return query.listing;
        var results=query.results; var rscores=query.scores;
        var scores={}; var sorted=[];
        var i=0; var lim=results.length;
        var scores=new Array(lim);
        while (i<lim) {
            var r=results[i++];
            var ref=Codex.docinfo[r]||Codex.glossdb.refs[r]||kbref(r)||r;
            if (!(ref)) continue;
            var frag=ref.frag;
            if (!(frag)) continue;
            sorted.push(ref);
            if (scores[frag]) 
                scores[frag]=scores[frag]+(rscores[r]||1);
            else {
                scores[frag]=rscores[r];}
            i++;}
        sorted.sort(function(x,y){
            var xfrag=x.frag; var yfrag=y.frag;
            if (xfrag===yfrag) {}
            else if (scores[x.frag]>scores[yfrag]) return -1;
            else if (scores[xfrag]<scores[yfrag]) return 1;
            var xqid=x._id; var yqid=y._id;
            if (rscores[xqid]>rscores[yqid]) return -1;
            else if (rscores[xqid]<rscores[yqid]) return 1;
            var xstart=x.starts_at; var ystart=y.starts_at;
            if (xstart<ystart) return -1;
            else if (xstart>ystart) return 1;
            var xend=x.ends_at; var yend=y.ends_at;
            if (xend<yend) return -1;
            else if (xend>yend) return 1;
            else return 0;});
        var div=fdjtDOM("div.codexslice.sbookresults");
        fdjtUI.TapHold(div,Codex.touch);
        Codex.UI.addHandlers(div,'summary');
        Codex.UI.showSlice(query.results,div,query,true);
        query.listing=div;
        return div;}
    RefDB.Query.prototype.showResults=
        function(){return showResults(this);};
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
