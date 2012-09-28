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
    
    var cxicon=Codex.icon;

    var Completions=fdjtUI.Completions;
    var addClass=fdjtDOM.addClass;
    var getChildren=fdjtDOM.getChildren;
    var getChild=fdjtDOM.getChild;
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
	    else if (query._results.length<7)
		showSearchResults();
	    else {fdjtID("CODEXSEARCHINPUT").focus();}}}

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
	var input=getChild(box,".searchinput");
	var cloudid=input.getAttribute("completions");
	var resultsid=input.getAttribute("results");
	var qtags=getChild(box,".qtags");
	var cloud=((cloudid)&&(fdjtID(cloudid)))||
	    getChild(box,".searchcloud");
	var results=((resultsid)&&(fdjtID(resultsid)))||
	    getChild(box,".searchresults");
	var resultcount=getChild(box,".resultcount");
	var refinecount=getChild(box,".refinecount");
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
		" result"+((result._results.length===1)?"":"s");
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
	addClass(completions.dom,"hudpanel");
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
	addClass(results,"hudpanel");
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
	var input=getChild(box,".searchinput");
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

    function makeCloud(dterms,scores,freqs,ranks_arg,noscale,
		       completions,init_cloud) {
	var start=new Date();
	var sbook_index=Codex.index;
	var sourcekb=Codex.sourcekb;
	var knodule=Codex.knodule;
	var cloud=init_cloud||false;
	var i=0; var n_terms=dterms.length;
	// Move it out of the flow
	var placeholder=false;
	if ((init_cloud)&&(init_cloud.parentNode)) {
	    placeholder=document.createTextNode("");
	    init_cloud.parentNode.replaceChild(placeholder,init_cloud);}
	var info=organize_dterms(dterms,scores,knodule,sourcekb);
	if (Codex.Trace.clouds)
	    log("Making cloud from %d dterms w/scores=%o [%d,%d] and freqs=%o",
		dterms.length,scores,info.max,info.min,freqs);
	// We use cues when there are no inputs if:
	var usecues=(n_terms>17)&& (// lots of terms AND
	    (info.n_primes>0) || // there are prime terms OR
	    (info.max!==info.min) || // scores are different OR
	    // there are a small number of real concepts to use
	    ((info.normals._count)<17) ||
		// there's are a lot of weak terms
		((n_dterms/info.normals._count)>4)
	    );
	if (cloud) {
	    fdjtDOM.addClass(cloud,"completions");
	    if (!(getChild(cloud,".showall")))
		fdjtDOM.prepend(cloud,getShowAll(usecues,n_terms));}
	else cloud=newCloud(getShowAll(usecues,n_terms));
	if (!(usecues)) fdjtDOM.addClass(cloud,"showempty");
	var prime=getChild(cloud,".prime")||cloud;
	var normal=getChild(cloud,".normal")||cloud;
	var weak=getChild(cloud,".weak")||cloud;
	var sources=getChild(cloud,".sources")||cloud;
	var words=getChild(cloud,".words")||cloud;
	var sections=getChild(cloud,".sections")||cloud;
	if (!(completions)) completions=new Completions(cloud);
	dterms=sort_dterms(dterms,sbook_index,ranks_arg);
	var nspans=0; var sumscale=0;
	var minscale=false; var maxscale=false;
	var domnodes=[]; var nodescales=[];
	var count=scores._count;
	var cuelim=scores._maxscore/2;
	var cscores=sbook_index.tagscores;
	var cfreqs=sbook_index.tagfreqs;
	var ctotal=sbook_index._allitems.length;
	var normals=((info.n_primes<17)&&(info.normals));
 	i=0; while (i<dterms.length) {
	    var dterm=dterms[i++];
	    var container=words; // The default
	    var ref=kbref(dterm,knodule);
	    var span=dtermSpan(completions,
			       dterm,ref,freqs,cfreqs,scores,
			       ((info.n_primes>17)||
				(info.normals._count>42)),
			       cuelim);
	    if (!(span)) continue;
	    var scaling=Math.sqrt(scores[dterm]||freqs[dterm]||1);
	    domnodes.push(span);
	    if ((scores)&&(!(noscale))) {
		if ((!(minscale))||(scaling<minscale)) minscale=scaling;
		if ((!(maxscale))||(scaling>maxscale)) maxscale=scaling;
		nodescales.push(scaling);}
	    if (!(ref)) {
		if (dterm[0]==="\u00A7") container=sections;
		else container=words;}
	    else if (ref.pool===sourcekb) container=sources;
	    else if (ref.prime) container=prime;
	    else if (ref.weak) container=weak;
	    else container=normal;
	    if ((completions)&&(!(span.parentNode)))
		completions.addCompletion(span,false,ref||dterm);
	    container.appendChild(span);
	    container.appendChild(document.createTextNode(" "));}
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
	// Put it back in the flow if neccessary
	if (placeholder)
	    placeholder.parentNode.replaceChild(cloud,placeholder);
	return completions;}
    Codex.makeCloud=makeCloud;

    function newCloud(preamble){
	var spans=[fdjtDOM("span.prime")," ",
		   fdjtDOM("span.normal")," ",
		   fdjtDOM("span.sections")," ",
		   fdjtDOM("span.weak")," ",
		   fdjtDOM("span.words")," ",
		   fdjtDOM("span.sources")];
	return fdjtDOM("div.completions",preamble,spans);}

    function dtermSpan(completions,
		       dterm,ref,freqs,cfreqs,scores,
		       justprime,min_score){
	var freq=freqs[dterm]||1;
	var cfreq=cfreqs[dterm]||1;
	var score=scores[dterm]||freq;
	var title=((freq===cfreq)?
		   ("score="+score+"; "+freq+" items"):
		   ("score="+score+"; "+freq+"/"+cfreq+" items"));
	var tagstring=((ref)?(ref._qid||ref.tagString()):(dterm));
	var known=completions.getByValue(tagstring);
	if (known.length) known=known[0]; else known=false;
	var span=known||cloudEntry(ref||dterm,title);
	if (!(span)) return span;
	if (!(known)) span.setAttribute("value",tagstring);
	if (freq===1) addClass(span,"singleton");
	if (justprime) {
	    if (ref.prime) addClass(span,"cue");}
	else if ((ref instanceof KNode)&&(!(ref.weak)))
	    addClass(span,"cue");
	else {}
	if ((min_score)&&(scores[dterm])&&
		 (scores[dterm]>min_score))
	    addClass(span,"cue");
	return span;}

    function getShowAll(use_cues,how_many){
	var showall=(use_cues)&&
	    fdjtDOM(
		"span.showall",
		fdjtDOM("span.showmore","more",
			((how_many)&&(" ("+how_many+")"))),
		fdjtDOM("span.showless","fewer"));
	if (showall) showall.onclick=showempty_ontap;
	return showall;}

    function sort_dterms(dterms,sbook_index,ranks_arg){
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
	    else return 1;})
	return copied;}

    function organize_dterms(dterms,scores,knodule,sourcekb){
	var min_score=false, max_score=false;
	var normals={}, n_normal=0, n_primes=0;
	var probeRef=fdjtKB.probeRef;
	var i=0; while (i<dterms.length) {
	    var dterm=dterms[i++];
	    var knode=fdjtKB.probeRef(dterm,knodule);
	    if ((knode)&&(knode.prime)) n_primes++;
	    if ((knode)&&(knode.pool!==sourcekb)&&(!(knode.weak))) {
		normals[dterm]=true; n_normal++;}
	    if (scores) {
		var score=scores[dterm];
		if (score) {
		    if (min_score===false) min_score=score;
		    else if (score<min_score) min_score=score;
		    if (score>max_score) max_score=score;}}}
	normals._count=n_normal;
	return {normals: normals, n_primes: n_primes,
		min: min_score, max: max_score};}

    function showempty_ontap(evt){
	var target=fdjtUI.T(evt);
	var completions=fdjtDOM.getParent(target,".completions");
	if (completions) {
	    fdjtUI.cancel(evt);
	    fdjtDOM.toggleClass(completions,"showempty");
	    setTimeout(function(){
		Codex.UI.updateScroller(completions);},
		       100);}}

    function cloudEntry(term,title){
	var sbook_index=Codex.index; var showname=term;
	var knodule=Codex.knodule;
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
	    span.title=""+sbook_index.freq(term)+" items: "+term;
	    return span;}
	var span=Knodule.HTML(term,knodule,false,true);
	if (span.title) span.title=title+"; "+span.title;
	else span.title=title+"; "+Completions.getKey(span);
	return span;}
    Codex.cloudEntry=cloudEntry;
    
    function add_searchtag(value){
	setQuery(Codex.extendQuery(Codex.query,value));}

    function searchCloud(){
	if (Codex.search_cloud) return Codex.search_cloud;
	else {
	    var tagscores=Codex.index.tagscores;
	    var alltags=Codex.index._alltags;
	    var tagfreqs=Codex.index.tagfreqs;
	    var completions=Codex.makeCloud(
		alltags,tagscores,tagfreqs,true,false,false,
		fdjtID("CODEXSEARCHCLOUD"));
	    completions.dom.onclick=cloud_ontap;
	    Codex.search_cloud=completions;
	    return Codex.search_cloud;}}
    Codex.searchCloud=searchCloud;

    function sizeCloud(completions,container,index){
	if (!(index)) index=Codex.index;
	if (!(container)) container=completions.dom;
	var nodes=getChildren(container,".completion");
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
