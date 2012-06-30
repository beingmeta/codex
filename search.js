/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/search.js ###################### */

/* Copyright (C) 2009-2012 beingmeta, inc.
   This file implements the search component of a 
   Javascript/DHTML UI for reading large structured documents (sBooks).

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

(function(){
    Codex.search_cloud=false;
    if (!(Codex.empty_cloud)) Codex.empty_cloud=false;
    if (!(Codex.show_refiners)) Codex.show_refiners=25;
    if (!(Codex.search_gotlucky)) Codex.search_gotlucky=7;
    
    function sbicon(name,suffix) {return Codex.graphics+name+(suffix||"");}
    function cxicon(name,suffix) {
	return Codex.graphics+"codex/"+name+(suffix||"");}

    var Completions=fdjtUI.Completions;
    var addClass=fdjtDOM.addClass;
    var log=fdjtLog;
    var kbref=fdjtKB.ref;

    /* Query functions */

    /* Set on main search input */
    // id="CODEXSEARCHINPUT" 
    // completions="CODEXSEARCHCLOUD"

    var Query=KnoduleIndex.Query;

    Codex.getQuery=function(){return Codex.query;}
    
    function setQuery(query){
	if (Codex.Trace.search) log("Setting working query to %o",query);
	var query=Codex.query=useQuery(query,fdjtID("CODEXSEARCH"));
	if (Codex.mode==="search") {
	    if (query._results.length===0) {}
	    else if ((query._results.length===1)&&
		(document.getElementById(query._results[0]))) {
		Codex.GoTo(query._results[0],"setQuery");}
	    else if (query._results.length<7)
		showSearchResults();
	    else {}}}

    Codex.setQuery=setQuery;

    function useQuery(query,box_arg){
	var result;
	if (query instanceof Query) result=query;
	else result=Codex.index.Query(query);
	var qstring=result.getString();
	if ((box_arg)&&(typeof box_arg === 'string'))
	    box_arg=document.getElementById(box_arg);
	var box=box_arg||result._box||fdjtID("CODEXSEARCH");
	if ((query.dom)&&(box)&&(box!==query.dom))
	    fdjtDOM.replace(box_arg,query.dom);
	if (qstring===box.getAttribute("qstring")) {
	    log("No change in query for %o to %o: %o/%o (%o)",
		box,result._query,result,result._refiners,qstring);
	    return;}
	if (Codex.Trace.search>1)
	    log("Setting query for %o to %o: %o/%o (%o)",
		box,result._query,result,result._refiners,qstring);
	else if (Codex.Trace.search)
	    log("Setting query for %o to %o: %d results/%d refiners (%o)",
		box,result._query,result._results.length,
		result._refiners._results.length,qstring);
	var input=fdjtDOM.getChild(box,".searchinput");
	var cloudid=input.getAttribute("completions");
	var resultsid=input.getAttribute("results");
	var qtags=fdjtDOM.getChild(box,".qtags");
	var cloud=((cloudid)&&(fdjtID(cloudid)))||
	    fdjtDOM.getChild(box,".searchcloud");
	var results=((resultsid)&&(fdjtID(resultsid)))||
	    fdjtDOM.getChild(box,".searchresults");
	var resultcount=fdjtDOM.getChild(box,".resultcount");
	var refinecount=fdjtDOM.getChild(box,".refinecount");
	// Update (clear) the input field
	input.value='';
	var elts=result._query; var i=0; var lim=elts.length;
	// Update 'notags' class
	if (elts.length) fdjtDOM.dropClass(box,"notags");
	else addClass(box,"notags");
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
			    showname.slice(end);}
		    title=tag;}
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
	if (result._results.length) {
	    resultcount.innerHTML=result._results.length+
		" passage"+((result._results.length===1)?"":"s");
	    fdjtDOM.dropClass(box,"noresults");}
	else {
	    resultcount.innerHTML="no results";
	    addClass(box,"noresults");}
	// Update the search cloud
	var n_refiners=
	    ((result._refiners)&&(result._refiners._results.length))||0;
	var completions=Codex.queryCloud(result);
	refinecount.innerHTML=n_refiners+
	    ((n_refiners===1)?(" associated tag"):(" associated tags"));
	fdjtDOM.dropClass(box,"norefiners");
	if (cloudid) completions.id=cloudid;
	if (Codex.Trace.search>1)
	    log("Setting search cloud for %o to %o",box,completions.dom);
	cloudid=cloud.id;
	fdjtDOM.replace(cloud,completions.dom);
	    completions.complete("");
	if (n_refiners===0) {
	    addClass(box,"norefiners");
	    refinecount.innerHTML="no refiners";}
	result._box=box; box.setAttribute(qstring,qstring);
	Codex.UI.updateScroller(completions.dom);
	return result;}
    Codex.useQuery=useQuery;

    function extendQuery(query,elt){
	var elts=[].concat(query._query);
	if (typeof elt === 'string') 
	    elts.push(kbref(elt)||elt);
	else elts.push(elt);
	return useQuery(query.index.Query(elts),query._box);}
    Codex.extendQuery=extendQuery;

    Codex.updateQuery=function(input_elt){
	var q=Knodule.Query.string2query(input_elt.value);
	if ((q)!==(Codex.query._query))
	    Codex.setQuery(q,false);};

    function showSearchResults(){
	var results=Codex.query.showResults();
	// addClass(results,"hudpanel");
	fdjtDOM.replace("CODEXSEARCHRESULTS",results);
	CodexMode("searchresults");
	fdjtID("CODEXSEARCHINPUT").blur();
	fdjtID("CODEXSEARCHRESULTS").focus();
	Codex.UI.updateScroller(fdjtID("CODEXSEARCHRESULTS"));}
    Codex.showSearchResults=showSearchResults;

    /* Call this to search */

    function startSearch(tag){
	setQuery([tag]);
	CodexMode("search");}
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
		var completeinfo=queryCloud(Codex.query);
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
		(Codex.query._results.length>0) &&
		(Codex.query._results.length<=Codex.search_gotlucky))
		showSearchResults();
	    else {
		/* Handle new info */
		var completeinfo=queryCloud(Codex.query);
		completeinfo.complete("");}
	    return false;}
	else if (ch===9) { /* tab */
	    var qstring=target.value;
	    var completeinfo=queryCloud(Codex.query);
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
	    var completeinfo=queryCloud(Codex.query);
	    completeinfo.docomplete(target);
	    setTimeout(function(){
		Codex.UI.updateScroller("CODEXSEARCHCLOUD");},
		       100);}}
    Codex.UI.handlers.search_keyup=searchInput_keyup;

    function searchUpdate(input,cloud){
	if (!(input)) input=fdjtID("CODEXSEARCHINPUT");
	if (!(cloud)) cloud=queryCloud(Codex.query);
	cloud.complete(input.value);}
    Codex.searchUpdate=searchUpdate;

    function searchInput_focus(evt){
	evt=evt||event||null;
	var input=fdjtDOM.T(evt);
	sbook_search_focus=true;
	if ((Codex.mode)&&(Codex.mode==='searchresults'))
	    CodexMode("search");
	searchUpdate(input);}
    Codex.UI.handlers.search_focus=searchInput_focus;

    function searchInput_blur(evt){
	evt=evt||event||null;
	sbook_search_focus=false;}
    Codex.UI.handlers.search_blur=searchInput_blur;

    function clearSearch(evt){
	var target=fdjtUI.T(evt||event);
	var box=fdjtDOM.getParent(target,".searchbox");
	var input=fdjtDOM.getChild(box,".searchinput");
	fdjtUI.cancel(evt);
	setQuery(Codex.empty_query);
	input.focus();}
    Codex.UI.handlers.clearSearch=clearSearch;
    
    Codex.toggleSearch=function(evt){
	evt=evt||event;
	if ((Codex.mode==="search")||
	    (Codex.mode==="searchresults"))
	    CodexMode(false);
	else {
	    CodexMode("search");
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

    function showResults(result){
	if (result._results_div) return result._results_div;
	var results=result._results; var rscores=result._scores;
	var scores={}; var sorted=[];
	var i=0; var lim=results.length;
	var scores=new Array(lim);
	while (i<lim) {
	    var r=results[i++];
	    var ref=Codex.docinfo[r]||Codex.glosses.map[r]||kbref(r)||r;
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
	if (!(result)) result=Codex.query;
	var div=fdjtDOM("div.codexslice.sbookresults");
	fdjtUI.TapHold(div,Codex.touch);
	Codex.UI.addHandlers(div,'summary');
	Codex.UI.showSlice(result._results,div,rscores);
	result._results_div=div;
	return div;}
    KnoduleIndex.Query.prototype.showResults=
	function(){return showResults(this);};
    
    /* Getting query cloud */

    function queryCloud(query){
	if (query._cloud) return query._cloud;
	else if ((query._query.length)===0) {
	    query._cloud=searchCloud();
	    return query._cloud;}
	else if (!(query._refiners)) {
	    query._cloud=Codex.empty_cloud;
	    return query._cloud;}
	else {
	    var refiners=query._refiners;
	    var completions=makeCloud(
		refiners._results,refiners,refiners._freqs);
	    var cloud=completions.dom;
	    cloud.onclick=cloud_ontap;
	    var n_refiners=query._refiners._results.length;
	    var hide_some=(n_refiners>Codex.show_refiners);
	    if (hide_some) {
		var cues=fdjtDOM.$(".cue",cloud);
		if (!((cues)&&(cues.length))) {
		    var compelts=fdjtDOM.$(".completion",cloud);
		    var i=0; var lim=((compelts.length<Codex.show_refiners)?
				      (compelts.length):(Codex.show_refiners));
		    while (i<lim) addClass(compelts[i++],"cue");}}
	    else addClass(cloud,"showempty");
	    query._cloud=completions;
	    return query._cloud;}}
    Codex.queryCloud=queryCloud;
    KnoduleIndex.Query.prototype.getCloud=function(){return queryCloud(this);};

    function cloud_ontap(evt){
	evt=evt||event;
	var target=fdjtDOM.T(evt);
	var completion=fdjtDOM.getParent(target,".completion");
	if (Codex.Trace.gestures) log("cloud tap on %o",completion);
	if (completion) {
	    var cinfo=Codex.query._cloud;
	    var value=cinfo.getValue(completion);
	    if (typeof value !== 'string') add_searchtag(value);
	    else  if (value.length===0) {}
	    else if (value.indexOf('@')>=0)
		add_searchtag(kbref(value));
	    else if ((Codex.knodule)&&(Codex.knodule.probe(value)))
		add_searchtag(Codex.knodule.probe(value));
	    else add_searchtag(value);
	    fdjtUI.cancel(evt);}
	else if (fdjtDOM.inherits(target,".resultcounts")) {
	    showSearchResults(Codex.query);
	    CodexMode("searchresults");
	    fdjtID("CODEXSEARCHINPUT").blur();
	    fdjtID("CODEXSEARCHRESULTS").focus();
	    fdjtUI.cancel(evt);}
	else if (fdjtDOM.inherits(target,".refinercounts")) {
	    var completions=fdjtDOM.getParent(target,".completions");
	    fdjtDOM.toggleClass(completions,"showempty");
	    fdjtDOM.cancel(evt);}
	else if (fdjtDOM.inherits(target,".maxcompletemsg")) {
	    var completions=fdjtDOM.getParent(target,".completions");
	    fdjtID("CODEXSEARCHINPUT").focus();
	    fdjtDOM.toggleClass(container,"showall");
	    fdjtDOM.cancel(evt);}
	else {}}
    Codex.UI.handlers.cloud_ontap=cloud_ontap;

    function makeCloud(dterms,scores,freqs,ranks_arg,noscale,completions){
	var sbook_index=Codex.index;
	var knodule=Codex.knodule
	var primescores=((knodule)&&(knodule.primescores));
	var start=new Date();
	var n_terms=dterms.length;
	var i=0, max_score=0, min_score=false, primecues=0;
	if (scores) {
	    var i=0; while (i<dterms.length) {
		var dterm=dterms[i++];
		if (primescores[dterm]) primecues++;
		var score=scores[dterm];
		if (score) {
		    if (min_score===false) min_score=score;
		    else if (score<min_score) min_score=score;
		    if (score>max_score) max_score=score;}}}
	if (Codex.Trace.clouds)
	    log("Making cloud from %d dterms w/scores=%o [%d,%d] and freqs=%o",
		dterms.length,scores,max_score,min_score,freqs);
	// We show cues if there are too many terms and we would have
	//  any cues to show Cues are either primescores or higher
	//  scored items
	var usecues=(!((n_terms<17)||
		       ((max_score===min_score)&&(primescores===0))));
	var spans=fdjtDOM("span");
	if (usecues) {
	    var showall=fdjtDOM(
		"span.showall",
		fdjtDOM("span.showmore","more"),
		fdjtDOM("span.showless","less"));
	    showall.onclick=showempty_ontap;}
	else fdjtDOM.addClass(completions,"showempty");
	var cloud=fdjtDOM("div.completions",showall,spans);
	if (!(completions)) completions=new Completions(cloud);
	var copied=[].concat(dterms);
	var ranks=(((ranks_arg===true)||(typeof ranks_arg==='undefined'))?
		   (sbook_index.rankTags()):
		   (ranks_arg));
	// We sort the keys by absolute frequency
	if (ranks===false) copied.sort();
	else copied.sort(function (x,y) {
	    var xrank=ranks[x]||0;
	    var yrank=ranks[y]||0;
	    if (xrank===yrank) {
		if (x<y) return -1;
		else if (x===y) return 0;
		else return 1;}
	    else if (xrank<yrank) return -1;
	    else return 1;});
	var nspans=0; var sumscale=0;
	var minscale=false; var maxscale=false;
	var domnodes=[]; var nodescales=[];
	var count=scores._count;
	var cuelim=scores._maxscore/2;
	var cscores=sbook_index.tagscores;
	var cfreqs=sbook_index.tagfreqs;
	var ctotal=sbook_index._allitems.length;
 	i=0; while (i<copied.length) {
	    var dterm=copied[i++];
	    var freq=freqs[dterm]||1;
	    var cfreq=cfreqs[dterm]||1;
	    var score=scores[dterm]||freq;
	    var scaling=Math.sqrt(score);
	    var title=((freq===cfreq)?
		       ("score="+score+"; "+freq+" items"):
		       ("score="+score+"; "+freq+"/"+cfreq+" items"));
	    var ref=kbref(dterm,knodule);
	    var span=KNodeCompletion(ref||dterm,title);
	    if (!(span)) continue;
	    if (freq===1) addClass(span,"singleton");
	    if ((usecues)&&
		((primescores[dterm])||
		 ((scores[dterm])&&(max_score>min_score)&&
		  (scores[dterm]>min_score))))
		addClass(span,"cue");
	    domnodes.push(span);
	    if ((scores)&&(!(noscale))) {
		if ((!(minscale))||(scaling<minscale)) minscale=scaling;
		if ((!(maxscale))||(scaling>maxscale)) maxscale=scaling;
		nodescales.push(scaling);}
	    span.setAttribute("value",dterm);
	    fdjtDOM(spans,span,"\n");
	    if (completions) completions.addCompletion(
		span,false,ref||dterm);}
	// fdjtLog("minscale=%o, maxscale=%o",minscale,maxscale);
	if (nodescales.length) {
	    var j=0; var jlim=domnodes.length;
	    var scalespan=maxscale-minscale;
	    while (j<jlim) {
		var node=domnodes[j];
		var scale=nodescales[j];
		node.style.fontSize=
		    (100+(100*((scale-minscale)/scalespan)))+'%';
		j++;}}
	var maxmsg=fdjtDOM
	("div.maxcompletemsg",
	 "There are a lot ","(",fdjtDOM("span.completioncount","really"),")",
	 " of completions.  ");
	fdjtDOM.prepend(cloud,maxmsg);
	var end=new Date();
	if (Codex.Trace.clouds)
	    fdjtLog("Made cloud for %d dterms in %f seconds",
		    dterms.length,(end.getTime()-start.getTime())/1000);
	return completions;}
    Codex.makeCloud=makeCloud;

    function showempty_ontap(evt){
	var target=fdjtUI.T(evt);
	var completions=fdjtDOM.getParent(target,".completions");
	if (completions) {
	    fdjtUI.cancel(evt);
	    fdjtDOM.toggleClass(completions,"showempty");
	    setTimeout(function(){
		Codex.UI.updateScroller(completions);},
		       100);}}

    function KNodeCompletion(term,title){
	var sbook_index=Codex.index; var showname=term;
	var knodule=sbook_index.knodule;
	if ((typeof term === "string") && (term[0]==="\u00A7")) {
	    // Handle section references as tags
	    if (showname.length>20) {
		var start=showname.indexOf(' ',8);
		var end=showname.lastIndexOf(' ',showname.length-8);
		if (start<0) start=8; if (end<0) end=showname.length-8;
		if (start<(showname.length-end)) {
		    showname=showname.slice(0,start)+" \u2026 "+
			showname.slice(end);}
		title=term;}
	    var span=fdjtDOM("span.completion",
			     fdjtDOM("span.sectname",showname));
	    span.key=term; span.value=term; span.anymatch=true;
	    if (title)
		span.title=title+"; "+term;
	    else span.title=""+sbook_index.freq(term)+" items: "+term;
	    return span;}
	var span=Knodule.HTML(term,knodule,false,true);
	if (span.title) span.title=title+"; "+span.title;
	else span.title=title+Completions.getKey(span);
	return span;}
    
    function add_searchtag(value){
	setQuery(Codex.extendQuery(Codex.query,value));}

    function searchCloud(){
	if (Codex.search_cloud) return Codex.search_cloud;
	else {
	    var tagscores=Codex.index.tagscores;
	    var alltags=Codex.index._alltags;
	    var tagfreqs=Codex.index.tagfreqs;
	    var completions=Codex.makeCloud(alltags,tagscores,tagfreqs,true);
	    completions.dom.onclick=cloud_ontap;
	    Codex.search_cloud=completions;
	    return Codex.search_cloud;}}
    Codex.searchCloud=searchCloud;

    function sizeCloud(completions,container,index){
	if (!(index)) index=Codex.index;
	if (!(container)) container=completions.dom;
	var nodes=fdjtDOM.getChildren(container,".completion");
	var tagscores=index.tagscores;
	var max_score=index.maxscore;
	var alltags=index._alltags;
	var i=0; var lim=nodes.length;
	while (i<lim) {
	    var tagnode=nodes[i++];
	    var tag=tagnode.value||completions.getValue(tagnode);
            if (!(tag)) continue;
	    if ((typeof tag === "string") && (tag[0]==="\u00A7")) continue;
	    var score=tagscores[tag];
	    if (score) tagnode.style.fontSize=(100+(100*(score/max_score)))+"%";}}
    Codex.sizeCloud=sizeCloud;

    Codex.UI.searchCloudToggle=function(){
	fdjtDOM.toggleClass(fdjtID('CODEXSEARCHCLOUD'),'showempty');
	Codex.UI.updateScroller(fdjtID('CODEXSEARCHCLOUD'));};

})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  End: ***
*/
