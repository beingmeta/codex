/* -*- Mode: Javascript; -*- */

var sbooks_id="$Id$";
var sbooks_version=parseInt("$Revision$".slice(10,-1));

/* Copyright (C) 2009-2010 beingmeta, inc.
   This file implements a Javascript/DHTML UI for reading
    large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knowlets, visit www.knowlets.net
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

sBook.Setup=
  (function(){

    var info=sBook.Info;
    var sbook_index=sBook.Index;
    var sbookOIDs=sBook.OIDs;
    
    var sbook_fullpages=[];
    var sbook_heading_qricons=false;
    var sbook_help_on_startup=false;

    /* Initialization */
    
    var _sbook_setup_start=false;
    
    function Setup(){
      if (sbook._setup) return;
      if (!(sbook._setup_start)) sbook._setup_start=new Date();
      if (sbook._setup) return;
      if (sbook.user) fdjtDOM.swapClass(document.body,"nosbookuser","sbookuser");
      else fdjtDOM.addClass(document.body,"nosbookuser");
      fdjtDOM.addClass(document.body,"sbooknovice");
      var fdjt_done=new Date();
      getSettings();
      sBook.Setup.HUD();
      displaySetup();
      if (!((document.location.search)&&
	    (document.location.search.length>0))) {
	sBookMode(false);
	sBook.Message("Setting up your sBook");}
      if (fdjtState.getQuery("action")) {
	sbookSetupDash();
	sBookMode("sbookapp");}
      if ((!(sbook_ajax_uri))||(sbook_ajax_uri==="")||(sbook_ajax_uri==="none"))
	sbook_ajax_uri=false;
      sBook.Message("Scanning document structure");
      var metadata=sbookScan(sbook.root);
      sBook.Info.map=metadata;
      sBook.Setup.NavHUD(metadata[sbook.root.id]);
      var scan_done=new Date();
      sBook.Message("Determining page layout");
      applySettings();
      if (sBook.pageview) sbookPaginate();
      var knowlet=fdjtDOM.getMeta("KNOWLET")||sBook.refuri;
      sBook.Message("Processing knowledge with knowlet ",knowlet);
      document.knowlet=knowlet=new Knowlet(knowlet);
      if ((Knowlet)&&(Knowlet.HTML)&&(Knowlet.HTML.Setup))
	Knowlet.HTML.Setup();
      var knowlets_done=new Date();
      sBook.Message("Indexing tags");
      sBook.Setup.indexTags(metadata);
      // sbookIndexTechnoratiTags(knowlet);
      var tags_done=new Date();
      if (fdjtID("SBOOKHIDEHELP"))
	fdjtID("SBOOKHIDEHELP").checked=(!(sbook_help_on_startup));
      if (sbook_gloss_data) {glossesSetup();}
      else {
	sBook.Message("Loading glosses...");
	var refuri=sBook.refuri; var added=[];
	var uri="https://"+sbook_server+"/sbook/glosses.fdcgi?URI="+
	  (encodeURIComponent(refuri))+
	  ((sBook.mycopyid)?("&MYCOPY="+encodeURIComponent(sBook.mycopyid)):(""));
	added.push(refuri);
	var i=0; while (i<sBook.refuris.length) {
	  if (fdjtKB.contains(added,sBook.refuris)) i++;
	  else {
	    var oref=sBook.refuris[i++];
	    uri=uri+'&'+oref; added.push(oref);}}
	var script_elt=fdjtDOM("SCRIPT");
	script_elt.language="javascript"; script_elt.src=uri;
	document.body.appendChild(script_elt);}
      var hud_done=new Date();
      initLocation();
      var hud_init_done=new Date();
      window.onresize=function(evt){sbookPaginate();};
      sBook.Setup.Gesture();
      sBook.Flash();
      // sbookFullCloud();
      _sbook_setup=sbook._setup=new Date();}
    sBook.Setup=Setup;

    /* Application settings */
    var sbook_allopts=
      [["page","scroll"],["sparse","rich"],["flash","noflash"],
       ["fetch","nofetch"],["setup","nosetup"]];
    
    var sbook_default_opts=["page","rich","flash","mouse"];
    var sbook_window_opts=[];
    var sbook_opts=[];
    function testopt(pos,neg,session){
      return fdjtState.testOption
	(pos,neg,
	 (session||fdjtState.getSession("sbookopts")),
	 fdjtState.getQuery("sbookopts"),
	 fdjtState.getLocal("sbookopts"),
	 fdjtDOM.getMeta("sbookopts"),
	 sbook_default_opts);}
    sBook.testopt=testopt;

    function applySettings(){
      // This applies the current session settings
      sBookUI.Sparse(testopt("sparse","rich"));
      sBookUI.Flash(testopt("flash","dull"));
      var tocmax=fdjtDOM.getMeta("SBOOKTOCMAX");
      if (tocmax) sbook_tocmax=parseInt(tocmax);
      var sbookhelp=fdjtDOM.getMeta("SBOOKHELP");
      if (sbookhelp) sbook_help_on_startup=true;
      sbookPaginate(testopt("page","scroll"));
      sBookUI(sbook_interaction);}

    function updateSessionSettings(delay){
      if (delay) {
	setTimeout(sbookUpdateSessionSettings,delay);
	return;}
      // This updates the session settings from the checkboxes 
      var sessionsettings="opts";
      if (fdjtID("SBOOKPAGEVIEW").checked)
	if (testopt("page","scroll","")) {}
	else sessionsettings=sessionsettings+" page";
      else if (testopt("scroll","page","")) {}
      else sessionsettings=sessionsettings+" scroll";
      if (fdjtID("SBOOKTOUCHMODE").checked)
	if (testopt("touch",["mouse","keyboard"],"")) {}
	else sessionsettings=sessionsettings+" touch";
      if (fdjtID("SBOOKMOUSEMODE").checked)
	if (testopt("mouse",["touch","keyboard"],"")) {}
	else sessionsettings=sessionsettings+" mouse";
      if (fdjtID("SBOOKKBDMODE").checked)
	if (testopt("keyboard",["touch","mouse"],"")) {}
	else sessionsettings=sessionsettings+" keyboard";
      if (fdjtID("SBOOKHUDFLASH").checked)
	if (testopt("flash","noflash","")) {}
	else sessionsettings="sessionsettings"+flash;
      else if (testopt("noflash","flash","")) {}
      else sessionsettings=sessionsettings+" noflash";
      if (fdjtID("SBOOKSPARSE").checked)
	if (testopt("sparse","rich","")) {}
	else sessionsettings=sessionsettings+" sparse";
      else if (testopt("sparse","rich","")) {}
      else sessionsettings=sessionsettings+" rich";
      fdjtSetSession("sbookopts",sessionsettings);
      applySettings();}

    function saveSettings(){
      var opts=fdjtGetSession("sbookopts");
      if (opts) {
	fdjtSetLocal("sbookopts",opts);
	fdjtDropLocal("sbookopts");}}
    sBook.saveSettings=saveSettings;

    // This is the base URI for this document, also known as the REFURI
    // A document (for instance an anthology or collection) may include
    // several refuri's, but this is the default.
    sBook.refuri=false;
    // These are the refuris used in this document
    sBook.refuris=[];
    // This is the document URI, which is usually the same as the REFURI.
    sBook.docuri=false;
    // This is the unique DOC identifier used by myCopy social DRM.
    sBook.mycopyid=false; 
    // Controls on excerpts
    var sbook_max_excerpt=false;
    // This is mostly a kludge to ignore selections which are really just clicks
    var sbook_min_excerpt=5;
    
    function getSettings(){
      // Basic stuff
      document.body.refuri=sBook.refuri=_getsbookrefuri();
      sBook.docuri=_getsbookdocuri();
      // Get the settings for scanning the document structure
      getScanSettings();
      // Get the settings for automatic pagination
      getPageSettings();
      sbook_max_excerpt=fdjtDOM.getMeta("SBOOKMAXEXCERPT")
	var sbooksrv=fdjtDOM.getMeta("SBOOKSERVER");
      if (sbooksrv) sbook_server=sbooksrv;
      else if (fdjtState.getCookie["SBOOKSERVER"])
	sbook_server=fdjtState.getCookie["SBOOKSERVER"];
      else sbook_server=lookupServer(document.domain);
      if (!(sbook_server)) sbook_server=sbook_default_server;
      sbook_ajax_uri=fdjtDOM.getMeta("SBOOKSAJAX",true);
      sBook.mycopyid=fdjtDOM.getMeta("SBOOKMYCOPY",false);

      if (testopt("touch",["mouse",",keyboard"]))
	sbook_interaction="touch";
      else if (testopt("keyboard",["mouse","touch"]))
	sbook_interaction="keyboard";
      else sbook_interaction="mouse";
      
      // Unavoidable browser sniffing
      var useragent=navigator.userAgent;
      if ((useragent.search("Safari/")>0)&&(useragent.search("Mobile/")>0))
	sbookMobileSafariSetup();}

    function sbookMobileSafariSetup(){
      var head=fdjtDOM.$("HEAD")[0];
      fdjt_format_console=true;

      document.body.ontouchmove=
	function(evt){
	var target=fdjtDOM.T(evt);
	if ((fdjtDOM.hasParent(target,"sbooksummaries"))||
	    (fdjtDOM.hasParent(target,sbookDash)))
	  return true;
	else if (sBook.pageview) {
	  evt.preventDefault(); return false;}};
      
      var head=fdjtDOM.$("HEAD")[0];
      var appmeta=fdjtElt("META");
      appmeta.name='apple-mobile-web-app-capable';
      appmeta.content='yes';
      // fdjtDOM.prepend(head,appmeta);

      var viewmeta=fdjtElt("META");
      viewmeta.name='viewport';
      viewmeta.content='user-scalable=no,width=device-width';
      fdjtDOM.prepend(head,viewmeta);

      sBook.Setup.notfixed=true;
      fdjtDOM.addClass(document.body,"notfixed");
  
      var mouseopt=fdjtKB.position(sbook_default_opts,"mouse");
      if (mouseopt<0)
	mouseopt=fdjtKB.position(sbook_default_opts,"keyboard");
      if (mouseopt<0)
	mouseopt=fdjtKB.position(sbook_default_opts,"oneclick");
      if (mouseopt<0) sbook_default_opts.push("touch");
      else sbook_default_opts[mouseopt]="touch";}

    /* Getting settings */

    function _getsbookrefuri(){
      // Explicit REFURI is just returned
      var refuri=fdjtDOM.getLink("REFURI",false,true)||
	fdjtDOM.getMeta("REFURI",false,true);
      if (refuri) return refuri;
      // No explicit value, try to figure one out
      // First, try the CANONICAL link
      refuri=fdjtDOM.getLink("canonical",false,true);
      // Otherwise, use the document location
      if (!(refuri)) {
	var locref=document.location.href;
	var qstart=locref.indexOf('?');
	if (qstart>=0) locref=locref.slice(0,qstart);
	refuri=locref;}
      return refuri;}
    function _getsbookdocuri(){
      var docuri=fdjtDOM.getLink("DOCURI",true)||
	fdjtDOM.getMeta("DOCURI",true)||
	fdjtDOM.getMeta("SBOOKSRC",true);
      if (docuri) return docuri;
      else return _getsbookrefuri();}

    function lookupServer(string){
      var sbook_servers=sBook.servers;
      var i=0;
      while (i<sbook_servers.length) 
	if (sbook_servers[i][0]===string)
	  return sbook_servers[i][1];
	else if (string.search(sbook_servers[i][0])>=0)
	  return sbook_servers[i][1];
	else if ((sbook_servers[i][0].call) &&
		 (sbook_servers[i][0].call(string)))
	  return sbook_servers[i][1];
	else i++;
      return false;}

    function getScanSettings(){
      if (!(sbook.root))
	if (fdjtDOM.getMeta("SBOOKROOT"))
	  sbook.root=fdjtID(fdjtDOM.getMeta("SBOOKROOT"));
	else sbook.root=document.body;
      if (!(sbook.start))
	if (fdjtDOM.getMeta("SBOOKSTART"))
	  sbook.start=fdjtID(fdjtDOM.getMeta("SBOOKSTART"));
	else if (fdjtID("SBOOKSTART"))
	  sbook.start=fdjtID("SBOOKSTART");
	else {
	  var titlepage=fdjtID("SBOOKTITLE")||fdjtID("TITLEPAGE");
	  while (titlepage)
	    if (fdjtDOM.nextElt(titlepage)) {
	      sbook.start=fdjtDOM.nextElt(titlepage); break;}
	    else titlepage=titlepage.parentNode;}
      var i=1; while (i<9) {
	var rules=fdjtDOM.getMeta("SBOOKHEAD"+i,true);
	if ((rules)&&(rules.length)) {
	  var j=0; var lim=rules.length;
	  var elements=fdjtDOM.getChildren(rules[j++]);
	  var k=0; var n=elements.length;
	  while (k<n) elements[k++].toclevel=i;}
	i++;}
      if (fdjtDOM.getMeta("SBOOKIGNORED")) 
	sbook_ignored=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKIGNORED"));
      if (fdjtDOM.getMeta("SBOOKIDIFY")) 
	sbook_idify=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKIDIFY"));
      if (fdjtDOM.getMeta("SBOOKIDIFY")) 
	sbook_idify=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKFOCI"));
      if (fdjtDOM.getMeta("SBOOKFOCI"))
	sbook_focus_rules=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKFOCI"));
      if (fdjtDOM.getMeta("SBOOKTERMINALS"))
	sbook_terminals=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKTERMINALS"));
      if (fdjtDOM.getMeta("SBOOKNOTAG"))
	sbook_terminals=new fdjtDOM.Selector(fdjtDOM.getMeta("SBOOKNOTAG"));}

    function getPageSettings(){
      var tocmajor=fdjtDOM.getMeta("SBOOKTOCMAJOR",true);
      if (tocmajor) sbook_tocmajor=parseInt(tocmajor);
      var sbook_fullpage_rules=fdjtDOM.getMeta("SBOOKFULLPAGE",true);
      if (sbook_fullpage_rules) {
	var i=0; while (i<sbook_fullpage_rules.length) {
	  sbook_fullpages.push(fdjtDOM.Selector(sbook_fullpage_rules[i++]));}}
      sbook_fullpages.push(fdjtDOM.Selector(".sbookfullpage, .titlepage"));}
 
    function displaySetup(){
      var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
      var bottomleading=fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
      var pagehead=makeMargin("div.sbookmargin#SBOOKPAGEHEAD"," ");
      var pagefoot=makeMargin("div.sbookmargin#SBOOKPAGEFOOT"," ");
      var leftedge=fdjtDOM("div#SBOOKLEFTEDGE.sbookmargin.sbookleft");
      var rightedge=fdjtDOM("div#SBOOKRIGHTEDGE.sbookmargin.sbookright");

      topleading.sbookui=true; bottomleading.sbookui=true;
      fdjtDOM.insertAfter
	(sbookHUD,pagehead,pagefoot,leftedge,rightedge,topleading);  
      fdjtDOM.append(document.body,bottomleading);
  
      sbookPageHead=pagehead; sbookPageFoot=pagefoot;
      // Probe the size of the head and foot
      pagehead.style.display='block'; pagefoot.style.display='block';
      sbook_top_px=pagehead.offsetHeight;
      sbook_bottom_px=pagefoot.offsetHeight;
      pagehead.style.display=''; pagefoot.style.display='';
      pagehead.sbookui=true; pagefoot.sbookui=true;
      // pagehead.onclick=sbookHeadHUD_onclick;
      // pagefoot.onclick=sbookFootHUD_onclick;

      sbook_left_px=leftedge.offsetWidth;
      sbook_right_px=rightedge.offsetWidth;

      // These are the edges above the bottom margin
      var leftedge2=fdjtDOM("div.sbookmargin.sbookleft#SBOOKLEFTEDGE2");
      var rightedge2=fdjtDOM("div.sbookmargin.sbookright#SBOOKRIGHTEDGE2");
      fdjtDOM(pagefoot,leftedge2,rightedge2);

      // The better way to do this might be to change the stylesheet,
      //  but fdjtDOM doesn't handle that currently
      var bgcolor=document.body.style.backgroundColor;
      if (!(bgcolor)) {
	var bodystyle=fdjtDOM.getStyle(document.body);
	var bgcolor=((bodystyle)&&(bodystyle.backgroundColor));
	if ((bgcolor==='transparent')||(bgcolor.search('rgba')>=0))
	  bgcolor=false;}
      if (bgcolor) {
	leftedge.style.backgroundColor=bgcolor;
	rightedge.style.backgroundColor=bgcolor;
	leftedge2.style.backgroundColor=bgcolor;
	rightedge2.style.backgroundColor=bgcolor;
	pagehead.style.backgroundColor=bgcolor;
	pagefoot.style.backgroundColor=bgcolor;}}

    function makeMargin(spec){
      var div=fdjtDOM(spec);
      div.onmouseover=fdjtDOM.cancel;
      div.onmouseout=fdjtDOM.cancel;
      div.onmousedown=fdjtDOM.cancel;
      div.onmouseup=fdjtDOM.cancel;
      div.onclick=sBook.dropHUD;
      return div;}

    function glossesSetup(){
      userSetup();
      if (sbook._gloss_setup) return;
      sbookImportGlosses();
      sBook.Message("Importing glosses...");
      var glosses_button=fdjtID("SBOOKGLOSSESBUTTON");
      glosses_button.style.visibility='';
      var search_button=fdjtID("SBOOKSEARCHBUTTON");
      search_button.style.visibility='';
      sBook.Message("Analyzing tag frequencies...");
      sbookTagScores();
      sBook.Message("Setting up search cloud...");
      sbookFullCloud();
      sBook.Message("Setting up glossing cloud...");
      fdjtDOM.replace("SBOOKMARKCLOUD",sbookMarkCloud());
      setupGlossServer();
      if (sbook.user)
	fdjtDOM.swapClass(document.body,"nosbookuser","sbookuser");
      if (fdjtID("SBOOKFRIENDLYOPTION"))
	if (sbook.user)
	  fdjtID("SBOOKFRIENDLYOPTION").value=sbook.user;
	else fdjtID("SBOOKFRIENDLYOPTION").value=null;
      if (sbook_heading_qricons) {
	sBook.Message("Adding print icons...");
	sbookAddQRIcons();}
      sBook.Message("Importing personal overlays...");
      // if (sbook.user) importOverlays();
      var done=new Date().getTime();
      sBook.Message("Completed sBook setup"," in ",
		    ((done-sbook._setup_start.getTime())/1000),
		    " seconds");
      // fdjtTrace("[%fs] Done with glosses setup",fdjtET());
      splash();
      sbook._gloss_setup=true;}
    sBook.Setup.Glosses=glossesSetup;

    function importOverlays(arg)
    {
      var invite_options=fdjtID("SBOOKINVITEOPTIONS");
      var mark_options=fdjtID("SBOOKMARKOPTIONS");
      var overlays=((arg)?((arg.oid)?(new Array(arg)):(arg)):sbook.user_overlays);
      var i=0; var n=overlays.length;
      while (i<n) {
	var info=overlays[i++];
	if (!(info.oid)) continue;
	else if (fdjtKB.contains(sbook_overlays,info.oid)) {}
	else {
	  var named="("+info.kind.slice(1)+") "+info.name;
	  sbook_overlays.push(info.oid);
	  var invite_option=fdjtElt("OPTION",named);
	  invite_option.title=info.about;
	  invite_option.value=info.oid;
	  fdjtDOM(invite_options,invite_option);
	  var mark_option=fdjtElt("OPTION",named);
	  mark_option.title=info.about;
	  mark_option.value=info.oid;
	  fdjtDOM(mark_options,mark_option);}
	sbookOIDs.Import(info);}}

    function socialSetup(){
      userSetup();
      if (sbook._social_setup) return;
      if (typeof sbook_tribes !== "undefined")
	sbookImportSocialInfo(sbook_social_info);
      if (sbook.user_canpost) {
	fdjtDOM.dropClass(document.body,"sbookcantpost");}
      sbook._social_setup=true;}
    sBook.Setup.social=socialSetup;

    function userSetup(){
      if (sbook._user_setup) return;
      if (!(sbook.user)) {
	fdjtDOM.addClass(document.body,"nosbookuser");
	return;}
      if ((sbook.user_data)&&(sbook.user_data.oid))
	sbookOIDs.Import(sbook.user_data);
      if (sbook.user) fdjtDOM.swapClass(document.body,"nosbookuser","sbookuser");
      var userinfo=sbookOIDs.map[sbook.user];
      var username=userinfo.name;
      if ((!(sbook.user_img))&&(userinfo.pic))
	sbook.user_img=userinfo.pic;
      fdjtID("SBOOKUSERNAME").innerHTML=username;
      if (fdjtID("SBOOKMARKUSER")) fdjtID("SBOOKMARKUSER").value=sbook.user;
      if (fdjtID("SBOOKMARKFORM"))
	fdjtID("SBOOKMARKFORM").onsubmit=fdjtAjax.onsubmit;
      if (sbook.user_img) {
	if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=sbook.user_img;
	if (fdjtID("SBOOKUSERPIC")) fdjtID("SBOOKUSERPIC").src=sbook.user_img;}
      var idlinks=document.getElementsByName("IDLINK");
      if (idlinks) {
	var i=0; var len=idlinks.length;
	while (i<len) {
	  var idlink=idlinks[i++];
	  idlink.target='_blank';
	  idlink.title='click to edit your personal information';
	  idlink.href='http://www.sbooks.net/admin/id.fdcgi';}}
      sbook._user_setup=true;}
    sBook.Setup.user=userSetup;

    /* This initializes the sbook state to the initial location with the
       document, using the hash value if there is one. */ 
    function initLocation() {
      var hash=window.location.hash; var target=sbook.root;
      if ((typeof hash === "string") && (hash.length>0)) {
	if ((hash[0]==='#') && (hash.length>1))
	  target=document.getElementById(hash.slice(1));
	else target=document.getElementById(hash);
	if (sBook.Trace.startup)
	  fdjtLog("[%f] sbookInitLocation %s=%o",fdjtET(),hash,target);}
      else if (fdjtState.getCookie("sbooktarget")) {
	var targetid=fdjtState.getCookie("sbooktarget");
	if (sBook.Trace.startup)
	  fdjtLog("[%f] sbookInitLocation cookie=#%s=%o",
		  fdjtET(),targetid,target);
	if ((targetid)&&(fdjtID(targetid)))
	  target=fdjtID(targetid);
	else target=sbook.root;}
      if (sBook.Trace.startup)
	fdjtLog("[%f] sbookInitLocation t=%o jf=%o",fdjtET(),target,justfocus);
      sBook.setHead(target||sbook.start||sbook.root);
      var tinfo=((target)&&(fdjtDOM.getGeometry(target)));
      sBook.GoTo(target||sbook.start||sbook.root,
		(!((tinfo)&&(tinfo.height<(fdjtDOM.viewHeight())))));}

    /* Other setup */
    
    function setupGlossServer(){
      var domain=document.domain;
      if ((sbook_server) && (domain===sbook_server))
	return;
      else if (sbook_server) {
	var common_suffix=fdjtString.commonSuffix(sbook_server,domain,'.');
	if (common_suffix) {
	  if (common_suffix.indexOf('.')>0) {
	    if (sBook.Trace.network)
	      fdjtLog("[%fs] Setting up access to gloss server %o from %o through %o",
		      fdjtET(),sbook_server,domain,common_suffix);
	    var iframe=fdjtDOM("iframe");
	    iframe.style.display='none';
	    iframe.id="SBOOKIBRIDGE";
	    iframe.onload=function() {
	      document.domain=common_suffix;
	      setIBridge(iframe.contentWindow);};
	    iframe.src=
	      'http://'+sbook_server+'/sbook/ibridge.fdcgi?DOMAIN='+
	      common_suffix;
	    document.body.appendChild(iframe);}}}}

    function setIBridge(window){
      sbook_ibridge=window;
      if (fdjtID("SBOOKMARKFORM")) fdjtID("SBOOKMARKFORM").ajaxbridge=window;}

    
    /* The Help Splash */
    function splash(){
      if ((document.location.search)&&
	  (document.location.search.length>0))
	sBookMode("sbookapp");
      else {
	var cookie=fdjtState.getCookie("sbookhidehelp");
	if (cookie==='no') sBookMode("help");
	else if (cookie) {}
	else if (sbook_help_on_startup) sBookMode("help");
	else if (!(sbook.mode)) {}
	else if (sbook.mode!=="console") {}
	else sBookMode(false);}}

    return Setup;})();
sbookSetup=sBook.Setup;
sbookGlossesSetup=sBook.Setup.Glosses;

/* Emacs local variables
;;;  Local variables: ***
;;;  compile-command: "cd ..; make" ***
;;;  End: ***
*/
